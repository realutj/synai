import { Command } from "commander";
import { copyFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import {
  findSystemBrowser,
  checkRemoteDebugging,
  BrowserManager,
  type BrowserActionParams,
} from "@synai/core";

export function createBrowserCommand(ctx?: { exitCode?: number }): Command {
  const markHandled = () => {
    if (ctx) ctx.exitCode = 0;
  };
  const markFailed = () => {
    if (ctx) ctx.exitCode = 1;
    process.exitCode = 1;
  };

  const cmd = new Command("browser")
    .alias("browse")
    .description("Control Chrome, inspect pages, capture screenshots, or extract page text")
    .argument("[url]", "Target web page URL to visit")
    .option("-s, --screenshot <filepath>", "Capture page screenshot and save to file")
    .option("-t, --text", "Extract page text without opening a Chrome window")
    .option("-e, --eval <script>", "Evaluate JavaScript expression inside the page")
    .option("-i, --inspect", "Inspect interactive form elements and buttons on the page")
    .option("--tabs", "List open Chrome tabs")
    .option("--new-tab", "Open the target URL in a new tab")
    .option("--tab <index>", "Select an open tab by zero-based index")
    .option("--click <selector>", "Click a page element by CSS selector")
    .option("--type <selector>", "Fill a field selected by CSS")
    .option("--type-text <text>", "Text to enter with --type")
    .option("--fill <json>", "Fill fields from a JSON object of CSS selectors to text")
    .option("--select <selector>", "Select a dropdown by CSS selector")
    .option("--value <value>", "Value for --select")
    .option("--key <key>", "Press a keyboard key such as Enter or Tab")
    .option("--scroll <direction>", "Scroll up or down")
    .option("--amount <pixels>", "Scroll distance in pixels", "500")
    .option("-H, --headless", "Run browser in headless background mode")
    .option("-p, --port <port>", "Chrome Remote Debugging (CDP) port", "9222")
    .option("--status", "Check browser and CDP connection status")
    .option("--close", "Close the SynAI browser session and leave personal Chrome windows open")
    .action(async (url: string | undefined, opts: {
      screenshot?: string;
      text?: boolean;
      eval?: string;
      inspect?: boolean;
      tabs?: boolean;
      newTab?: boolean;
      tab?: string;
      click?: string;
      type?: string;
      typeText?: string;
      fill?: string;
      select?: string;
      value?: string;
      key?: string;
      scroll?: string;
      amount?: string;
      headless?: boolean;
      port?: string;
      status?: boolean;
      close?: boolean;
    }) => {
      const port = Number(opts.port || "9222");
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error("[!] --port must be an integer from 1 to 65535.");
        markFailed();
        return;
      }

      if (opts.status) {
        await checkStatus(port);
        markHandled();
        return;
      }

      if (opts.close) {
        const closed = await closeSessions(port);
        if (closed) markHandled();
        else markFailed();
        return;
      }

      const hasChromeAction = Boolean(
        opts.screenshot || opts.inspect || opts.eval || opts.tabs || opts.newTab ||
        opts.tab !== undefined || opts.click || opts.type || opts.fill || opts.select ||
        opts.key || opts.scroll,
      );
      const readTextOnly = opts.text === true && !hasChromeAction;

      if (!url && !hasChromeAction) {
        console.log("\n[*] SynAI Autonomous Web Browser Automation");
        console.log("--------------------------------------------------");
        console.log("Usage examples:");
        console.log("  synai browser https://github.com --text");
        console.log("  synai browser https://example.com --click 'button[type=submit]'");
        console.log("  synai browser --tabs");
        console.log("  synai browser https://example.com --screenshot ./page.png");
        console.log("  synai browser https://example.com --inspect");
        console.log("  synai browser https://example.com --eval \"document.title\"");
        console.log("  synai browser --status\n");
        markHandled();
        return;
      }

      // Ensure valid URL scheme
      let targetUrl: string | undefined;
      if (url) {
        targetUrl = url;
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = "https://" + targetUrl;
        }
        console.log(`\n[*] Chrome target: ${targetUrl}`);
      }

      const tabIndex = opts.tab === undefined ? undefined : Number(opts.tab);
      if (opts.tab !== undefined && (!Number.isInteger(tabIndex) || tabIndex! < 0)) {
        console.error("[!] --tab must be a zero-based nonnegative integer.");
        markFailed();
        return;
      }
      if ((opts.tabs && (opts.newTab || opts.tab !== undefined)) || (opts.newTab && opts.tab !== undefined)) {
        console.error("[!] Choose one of --tabs, --new-tab, or --tab in a single command.");
        markFailed();
        return;
      }
      if (opts.type && opts.typeText === undefined) {
        console.error("[!] --type requires --type-text.");
        markFailed();
        return;
      }
      if (opts.select && opts.value === undefined) {
        console.error("[!] --select requires --value.");
        markFailed();
        return;
      }
      const scrollAmount = Number(opts.amount || "500");
      if (opts.scroll && (opts.scroll !== "up" && opts.scroll !== "down")) {
        console.error("[!] --scroll must be up or down.");
        markFailed();
        return;
      }
      if (opts.scroll && (!Number.isInteger(scrollAmount) || scrollAmount < 1 || scrollAmount > 5000)) {
        console.error("[!] --amount must be an integer from 1 to 5000.");
        markFailed();
        return;
      }
      let fillFields: Record<string, string> | undefined;
      if (opts.fill) {
        try {
          const parsed: unknown = JSON.parse(opts.fill);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).length === 0 || Object.values(parsed).some((v) => typeof v !== "string")) {
            throw new Error("expected a non-empty object mapping CSS selectors to text values");
          }
          fillFields = parsed as Record<string, string>;
        } catch (error) {
          console.error(`[!] --fill must be valid JSON with text values: ${error instanceof Error ? error.message : String(error)}`);
          markFailed();
          return;
        }
      }

      const headless = opts.headless === true;
      const usesChrome = !readTextOnly;
      const cdpStatus = usesChrome ? await checkRemoteDebugging(port) : undefined;
      const browserPath = usesChrome && !cdpStatus?.available ? findSystemBrowser() : undefined;
      if (usesChrome && !cdpStatus?.available && !browserPath) {
        console.error("[!] No Chrome or Edge browser installation found on system.");
        markFailed();
        return;
      }

      const manager = BrowserManager.getInstance();
      manager.setRemoteDebuggingPort(port);

      try {
        const runAction = async (
          action: BrowserActionParams["action"],
          params: Omit<BrowserActionParams, "action" | "headless"> = {},
        ) => {
          const result = await manager.execute(process.cwd(), { ...params, action, headless });
          if (result.isError) throw new Error(result.output);
          return result;
        };

        if (readTextOnly) {
          if (!targetUrl) throw new Error("A URL is required to extract page text.");
          const res = await runAction("read_url", { url: targetUrl });
          console.log(`\n${res.output}\n`);
        } else {
          if (opts.newTab) {
            const res = await runAction("new_tab", { url: targetUrl });
            console.log(`[OK] ${res.output}`);
          } else if (opts.tabs) {
            const res = await runAction("tabs");
            console.log(`\n${res.output}\n`);
          } else if (opts.tab !== undefined) {
            const res = await runAction("select_tab", { tabIndex: tabIndex! });
            console.log(`[OK] ${res.output}`);
            if (targetUrl) {
              const navigation = await runAction("navigate", { url: targetUrl });
              console.log(navigation.output);
            }
          } else if (targetUrl) {
            const res = await runAction("navigate", { url: targetUrl });
            console.log(`\n${res.output}\n`);
          }

          if (opts.click) {
            const res = await runAction("click", { selector: opts.click });
            console.log(`[OK] ${res.output}`);
          }
          if (opts.type) {
            const res = await runAction("type", { selector: opts.type, text: opts.typeText });
            console.log(`[OK] ${res.output}`);
          }
          if (opts.fill) {
            const res = await runAction("fill_form", { fields: fillFields! });
            console.log(`[OK] ${res.output}`);
          }
          if (opts.select) {
            if (opts.value === undefined) throw new Error("--select requires --value.");
            const res = await runAction("select_option", { selector: opts.select, value: opts.value });
            console.log(`[OK] ${res.output}`);
          }
          if (opts.key) {
            const res = await runAction("press_key", { key: opts.key });
            console.log(`[OK] ${res.output}`);
          }
          if (opts.scroll) {
            const res = await runAction("scroll", { direction: opts.scroll as "up" | "down", amount: scrollAmount });
            console.log(`[OK] ${res.output}`);
          }

          if (opts.inspect) {
            const res = await runAction("inspect", { url: targetUrl });
            console.log(`\n${res.output}\n`);
          }
          if (opts.eval) {
            const res = await runAction("evaluate", { url: targetUrl, script: opts.eval });
            console.log(`\n[OK] Evaluation Result:\n${res.output}\n`);
          }
          if (opts.screenshot) {
          const outPath = path.resolve(process.cwd(), opts.screenshot);
          console.log(`[*] Capturing screenshot... Target: ${outPath}`);
          const res = await runAction("screenshot", { url: targetUrl });
          if (res.isError || !res.screenshotPath) throw new Error(res.output || "Screenshot capture failed.");
          const sourcePath = path.resolve(process.cwd(), res.screenshotPath);
          if (sourcePath !== outPath) {
            await mkdir(path.dirname(outPath), { recursive: true });
            await copyFile(sourcePath, outPath);
            await unlink(sourcePath).catch(() => {});
          }
          console.log(`[OK] Screenshot saved: ${outPath}`);
          }
          if (opts.text && targetUrl) {
            const res = await runAction("read_url", { url: targetUrl });
            console.log(`\n${res.output}\n`);
          }
        }
        markHandled();
      } catch (err) {
        console.error(`[!] Browser automation error: ${err instanceof Error ? err.message : String(err)}`);
        markFailed();
      } finally {
        if (usesChrome) {
          if (headless) {
            await manager.execute(process.cwd(), { action: "close" });
          } else {
            await manager.release();
          }
        }
      }
    });

  return cmd;
}

async function checkStatus(port: number): Promise<void> {
  console.log("\n[*] SynAI Browser Status");
  console.log("--------------------------------------------------");
  const browserPath = findSystemBrowser();
  if (browserPath) {
    console.log(`  System Browser     : [OK] ${browserPath}`);
  } else {
    console.log("  System Browser     : [!] Not Found");
  }

  const cdp = await checkRemoteDebugging(port);
  if (cdp.available) {
    console.log(`  CDP Debug Port     : [OK] Active on port ${port}`);
    console.log(`  Browser Version    : ${cdp.browser || "Unknown"}`);
    if (cdp.tabs && cdp.tabs.length > 0) {
      console.log(`  Open Tabs          : ${cdp.tabs.length} active tab(s)`);
      cdp.tabs.forEach((t, i) => {
        console.log(`    [${i + 1}] ${t.title} (${t.url})`);
      });
    }
  } else {
    console.log(`  CDP Debug Port     : [-] Port ${port} inactive (will auto-launch on demand)`);
  }
  console.log("--------------------------------------------------\n");
}

async function closeSessions(port: number): Promise<boolean> {
  console.log("[*] Closing active browser sessions...");
  try {
    const manager = BrowserManager.getInstance();
    manager.setRemoteDebuggingPort(port);
    const cdp = await checkRemoteDebugging(port);
    if (cdp.available) {
      await manager.connectToRemote(port);
      const res = await manager.execute(process.cwd(), { action: "close" });
      console.log(`[OK] ${res.output}`);
    } else {
      console.log("[OK] No SynAI browser connection is active on that port.");
    }
    return true;
  } catch (err: any) {
    console.error(`[!] Could not close the SynAI browser session: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
