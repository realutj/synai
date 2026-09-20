#!/usr/bin/env bun

import { isMainThread } from "node:worker_threads";
import {
  claimHubDaemonProcess,
  claimSupervisedConnectorProcess,
  disposeAll,
  initVcr,
  setConnectorCliLaunchSpec,
} from "@synai/shared";
import { logCliProcessError } from "./logging/errors";
import {
  abortActiveRuntime,
  cleanupActiveRuntime,
  isAbortInProgress,
} from "./runtime/active-runtime";
import { resolveCliLaunchSpec } from "./utils/internal-launch";
import { writeErr } from "./utils/output";

// Initialize VCR before any HTTP requests are made.
// Set SYNAI_VCR=record|playback and SYNAI_VCR_CASSETTE=<path> to enable.
initVcr(process.env.SYNAI_VCR);

if (!isMainThread) {
  // Worker imports of the bundled CLI entrypoint should not start the CLI.
} else if (claimHubDaemonProcess()) {
  // Claim rather than read: the sentinel is consumed here so the processes a
  // daemon-hosted session spawns do not inherit it and try to become daemons.
  // The hub daemon owns its process-level abort handling. Installing the CLI's
  // fatal rejection handler first would make expected abort rejections exit it.
  // void import("@synai/core/hub/daemon-entry");
  console.log("Hub daemon mode not yet implemented");
  process.exit(0);
} else {
  // Same reasoning as the daemon sentinel above: consume the supervised-connector
  // marker so the processes an agent session spawns cannot inherit it and mistake
  // themselves for the connector the hub is tracking.
  claimSupervisedConnectorProcess();

  const cliLaunchSpec = resolveCliLaunchSpec({ debugRole: "connector" });
  if (cliLaunchSpec) {
    setConnectorCliLaunchSpec({
      launcher: cliLaunchSpec.launcher,
      connectArgsPrefix: [...cliLaunchSpec.childArgsPrefix, "connect"],
      cwd: process.cwd(),
    });
  }

  let shuttingDown = false;
  let handlingFatalProcessError = false;
  const forwardSignalToRuntime = () => {
    if (shuttingDown) {
      process.exit(1);
    }
    shuttingDown = true;
    abortActiveRuntime();
  };
  process.on("SIGINT", forwardSignalToRuntime);
  process.on("SIGTERM", forwardSignalToRuntime);
  function isAbortError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof Error) {
      if (error.name === "AbortError") return true;
      if (
        typeof error.message === "string" &&
        (error.message.includes("The operation was aborted") ||
          error.message.includes("This operation was aborted") ||
          error.message.includes("user aborted") ||
          error.message.toLowerCase().includes("aborted"))
      ) {
        return true;
      }
    }
    const err = error as {
      name?: string;
      message?: string;
      type?: string;
      code?: number | string;
    };
    if (
      err.name === "AbortError" ||
      err.code === 20 ||
      err.code === "ABORT_ERR" ||
      err.type === "DOMException"
    ) {
      return true;
    }
    if (
      typeof err.message === "string" &&
      err.message.toLowerCase().includes("abort")
    ) {
      return true;
    }
    return false;
  }

  const handleFatalProcessError = (kind: string, error: unknown) => {
    if (isAbortError(error) || isAbortInProgress()) {
      return;
    }
    if (handlingFatalProcessError) {
      process.exit(1);
    }
    handlingFatalProcessError = true;
    logCliProcessError(kind, error);
    writeErr(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    cleanupActiveRuntime();
    abortActiveRuntime();
    void disposeAll().finally(() => {
      process.exit(1);
    });
  };
  process.on("uncaughtException", (error) => {
    if (isAbortError(error) || isAbortInProgress()) {
      return;
    }
    handleFatalProcessError("uncaughtException", error);
  });
  process.on("unhandledRejection", (reason, promise) => {
    promise.catch(() => {});
    if (isAbortInProgress() || isAbortError(reason)) {
      // Mark the promise as handled so OpenTUI's error overlay
      // does not surface expected abort-related rejections.
      return;
    }
    handleFatalProcessError("unhandledRejection", reason);
  });

  void (async () => {
    let exitCode = 0;
    try {
      const { runCli } = await import("./main");
      await runCli();
    } catch (err) {
      logCliProcessError("runCli", err);
      writeErr(err instanceof Error ? err.message : String(err));
      cleanupActiveRuntime();
      abortActiveRuntime();
      exitCode = 1;
    } finally {
      await disposeAll();
    }
    // The explicit process.exit below means beforeExit never fires, so a
    // startup-recorded auto-update must be applied here, after all runtime
    // teardown. It spawns detached and only when no other CLI is attached.
    try {
      const { applyDeferredUpdate } = await import("./commands/update");
      await applyDeferredUpdate();
    } catch {
      // Best-effort; never block exit on the updater.
    }
    process.exit(exitCode || (process.exitCode as number) || 0);
  })();
}
