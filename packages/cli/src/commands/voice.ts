/**
 * Voice Chat Command
 * Chat with AI in the terminal and hear responses through system text-to-speech
 */

import { Command } from "commander";
import * as readline from "node:readline";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { platform } from "node:os";
import { createCliCore } from "../session/session";
import { ProviderSettingsManager } from "@synai/core";

let writeln: (str: string) => void = console.log;
let writeErr: (str: string) => void = console.error;
let reportExitCode: (code: number) => void = (code) => { process.exitCode = code; };

export function setVoiceOutput(
  writeOutput: (str: string) => void,
  writeError: (str: string) => void,
  setExitCode?: (code: number) => void,
) {
  writeln = writeOutput;
  writeErr = writeError;
  if (setExitCode) reportExitCode = setExitCode;
}

interface VoiceOptions {
  language?: string;
  voice?: string;
  autoSpeak?: boolean;
  provider?: string;
  model?: string;
  key?: string;
  listVoices?: boolean;
}

let activeSpeechProcess: ChildProcess | undefined;
let speechGeneration = 0;

/**
 * Create the voice chat command
 */
export function createVoiceCommand(): Command {
  const cmd = new Command("voice").alias("speak").alias("talk");

  cmd
    .description(
      "[VOICE] Chat in the terminal and optionally hear AI responses",
    )
    .option(
      "-l, --language <code>",
      "Language for spoken AI responses (default: en-US)",
      "en-US",
    )
    .option(
      "-v, --voice <name>",
      "Voice for text-to-speech (default: system default)",
    )
    .option(
      "--no-auto-speak",
      "Don't automatically speak AI responses",
    )
    .option("-P, --provider <id>", "AI provider (default: openrouter)")
    .option("-m, --model <id>", "AI model to use")
    .option("-k, --key <api-key>", "API key override")
    .option("--list-voices", "List system voices available for speech output")
    .addHelpText(
      "after",
      `

Voice Commands (during session):
  "exit" or "quit"     - End voice chat session
  "stop speaking"      - Stop current speech
  "repeat"             - Repeat last response
  "mute"               - Disable auto-speak
  "unmute"             - Enable auto-speak

Examples:
  $ synai voice
  $ synai voice --language en-US
  $ synai voice --model claude-3.5-sonnet
  $ synai voice --no-auto-speak

Supported Languages:
  en-US - English (US)
  en-GB - English (UK)
  es-ES - Spanish
  fr-FR - French
  de-DE - German
  ja-JP - Japanese
  zh-CN - Chinese
  ar-SA - Arabic
    `,
    )
    .action(async (options: VoiceOptions) => {
      if (options.listVoices) {
        const voices = await listVoices();
        voices.forEach((voice) => writeln(voice));
        if (voices.length === 0) {
          writeErr("No speech voices were found on this system.");
        }
        reportExitCode(voices.length > 0 ? 0 : 1);
        return;
      }
      await runVoiceChat(options);
    });

  return cmd;
}

/**
 * Check if text-to-speech is available
 */
function checkTTSAvailability(): boolean {
  const os = platform();
  
  if (os === "win32") {
    // Windows has built-in TTS via PowerShell
    return true;
  } else if (os === "darwin") {
    // macOS has built-in TTS via 'say'
    return true;
  } else if (os === "linux") {
    return ["espeak-ng", "espeak", "festival"].some((command) => {
      const locator = spawnSync("which", [command], { stdio: "ignore" });
      return locator.status === 0;
    });
  }
  
  return false;
}

/**
 * Speak text using system TTS
 */
async function speakText(text: string, voice?: string, language = "en-US"): Promise<boolean> {
  const os = platform();
  const generation = speechGeneration;
  if (os === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Speech",
      "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
      "if ($env:SYNAI_TTS_VOICE) { $synth.SelectVoice($env:SYNAI_TTS_VOICE) } else { $culture = $env:SYNAI_TTS_LANGUAGE; $voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq $culture } | Select-Object -First 1; if (-not $voice) { $language = $culture.Split('-')[0]; $voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name.StartsWith($language) } | Select-Object -First 1 }; if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) } }",
      "$synth.Speak($env:SYNAI_TTS_TEXT)",
      "$synth.Dispose()",
    ].join("; ");
    await runSpeechProcess("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
      SYNAI_TTS_TEXT: text,
      SYNAI_TTS_VOICE: voice || "",
      SYNAI_TTS_LANGUAGE: language,
    });
    return generation === speechGeneration;
  }
  if (os === "darwin") {
    await runSpeechProcess("say", [...(voice ? ["-v", voice] : []), text]);
    return generation === speechGeneration;
  }

  const espeak = ["espeak-ng", "espeak"].find((command) => {
    return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
  });
  if (espeak) {
    try {
      await runSpeechProcess(
        espeak,
        [...(voice ? ["-v", voice] : ["-v", language.toLowerCase()])],
        {},
        text,
      );
      return generation === speechGeneration;
    } catch (error) {
      if (speechGeneration !== generation) return false;
      if (spawnSync("which", ["festival"], { stdio: "ignore" }).status !== 0) throw error;
    }
  }
  if (speechGeneration !== generation) return false;
  await runSpeechProcess("festival", ["--tts"], undefined, text);
  return generation === speechGeneration;
}

function runSpeechProcess(
  command: string,
  args: string[],
  env: Record<string, string> = {},
  stdinText?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const generation = speechGeneration;
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: stdinText === undefined ? "ignore" : ["pipe", "ignore", "ignore"],
      });
    } catch (error) {
      reject(error);
      return;
    }
    activeSpeechProcess = child;
    if (stdinText !== undefined && child.stdin) {
      child.stdin.end(stdinText);
    }
    child.once("error", (error) => {
      if (activeSpeechProcess === child) activeSpeechProcess = undefined;
      if (generation !== speechGeneration) {
        resolve();
        return;
      }
      reject(error);
    });
    child.once("close", (code) => {
      if (activeSpeechProcess === child) activeSpeechProcess = undefined;
      if (generation !== speechGeneration) {
        resolve();
        return;
      }
      if (code === 0) resolve();
      else reject(new Error(`${command} speech process exited with code ${code ?? "unknown"}`));
    });
  });
}

function stopSpeaking(): boolean {
  const child = activeSpeechProcess;
  if (!child || child.killed) return false;
  speechGeneration += 1;
  child.kill();
  activeSpeechProcess = undefined;
  return true;
}

/**
 * List available voices
 */
export async function listVoices(): Promise<string[]> {
  return new Promise((resolve) => {
    const os = platform();

    if (os === "win32") {
      const psScript = `
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
      `;
      const proc = spawn("powershell", ["-Command", psScript]);
      let output = "";
      if (proc.stdout) {
        proc.stdout.on("data", (data) => {
          output += data.toString();
        });
      }
      proc.once("error", () => resolve([]));
      proc.on("close", () => {
        const lines = output.trim().split("\n");
        resolve(lines.filter((l) => l.trim()));
      });
    } else if (os === "darwin") {
      const proc = spawn("say", ["-v", "?"]);
      let output = "";
      if (proc.stdout) {
        proc.stdout.on("data", (data) => {
          output += data.toString();
        });
      }
      proc.once("error", () => resolve([]));
      proc.on("close", () => {
        const lines = output.trim().split("\n");
        const voiceNames = lines.map((l) => l.split(/\s+/)[0]).filter((v) => v);
        resolve(voiceNames);
      });
    } else if (os === "linux") {
      const espeak = ["espeak-ng", "espeak"].find((command) => {
        return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
      });
      if (!espeak) {
        resolve([]);
        return;
      }
      const proc = spawn(espeak, ["--voices"]);
      let output = "";
      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });
      proc.once("error", () => resolve([]));
      proc.once("close", (code) => {
        if (code !== 0) {
          resolve([]);
          return;
        }
        const voices = output
          .split(/\r?\n/)
          .slice(1)
          .map((line) => line.trim().split(/\s+/)[1])
          .filter((voice): voice is string => Boolean(voice));
        resolve([...new Set(voices)]);
      });
    } else {
      resolve([]);
    }
  });
}

/**
 * Run voice chat session
 */
async function runVoiceChat(options: VoiceOptions): Promise<void> {
  writeln("[VOICE] Voice Chat Mode");
  writeln("-----------------------------------------------------\n");

  // Check TTS availability
  if (!checkTTSAvailability()) {
    writeErr(
      "[!] Text-to-speech not available on this system.",
    );
    writeln("You can continue in text-only mode.\n");
  }

  // Show available voices
  if (options.voice) {
    writeln(`[AUDIO] Voice: ${options.voice}`);
  } else {
    writeln("[AUDIO] Using system default voice");
  }

  writeln(`[LANG] Language: ${options.language}`);
  writeln(`[MODEL] Model: ${options.model || "default"}`);
  writeln(`[INFO] Auto-speak: ${options.autoSpeak !== false ? "enabled" : "disabled"}\n`);

  writeln("Type messages here; SynAI will answer using your selected model and can speak the response.");
  writeln("Microphone transcription is available in the desktop/web voice interface, not in this terminal command.");
  writeln('(Type "exit" to quit)\n');

  const cwd = process.cwd();
  const providerId = options.provider?.trim().toLowerCase() || "openrouter";
  const providerSettings = new ProviderSettingsManager().getProviderSettings(providerId);
  const core = await createCliCore({ cwd, workspaceRoot: cwd });
  let sessionId: string;
  try {
    const started = await core.start({
      source: "cli-voice",
      interactive: true,
      config: {
        cwd,
        workspaceRoot: cwd,
        providerId,
        modelId: options.model || providerSettings.modelId || providerSettings.model,
        apiKey: options.key,
        baseUrl: providerSettings.baseUrl,
        mode: "dry-run",
        systemPrompt: `This is a spoken-response chat. Keep answers concise and natural to hear aloud. Respond in ${options.language || "en-US"} unless the user asks for another language. Do not modify files or run commands.`,
      },
    });
    sessionId = started.sessionId;
  } catch (error) {
    await core.dispose("cli_voice_start_failed");
    throw error;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let lastResponse = "";
  let autoSpeak = options.autoSpeak !== false;
  let isProcessing = false;
  const inputQueue: string[] = [];
  let isDrainingQueue = false;

  const processInput = async (input: string) => {
    const text = input.trim().toLowerCase();

    // Handle voice commands
    if (text === "exit" || text === "quit") {
      writeln("\n[EXIT] Ending voice chat session...");
      rl.close();
      return;
    }

    if (text === "stop speaking") {
      writeln(stopSpeaking() ? "[MUTE] Speech stopped." : "[INFO] Nothing is being spoken.");
      return;
    }

    if (text === "repeat") {
      if (lastResponse) {
        writeln("\n[AUDIO] Repeating last response...");
        if (autoSpeak) {
          stopSpeaking();
          void speakText(lastResponse, options.voice, options.language).catch((err) =>
            writeErr(`[FAIL] TTS error: ${err instanceof Error ? err.message : String(err)}`),
          );
        }
      } else {
        writeln("[!] No previous response to repeat");
      }
      return;
    }

    if (text === "mute") {
      autoSpeak = false;
      stopSpeaking();
      writeln("[MUTE] Auto-speak disabled");
      return;
    }

    if (text === "unmute") {
      autoSpeak = true;
      writeln("[AUDIO] Auto-speak enabled");
      return;
    }

    if (!input.trim()) {
      return;
    }

    // Process AI request
    isProcessing = true;
    writeln(`\n> You: ${input}`);
    writeln("[AI] Thinking...\n");

    try {
      const result = await core.send({ sessionId, prompt: input });
      const response = result.text?.trim();
      if (!response) throw new Error("The model returned an empty response.");
      lastResponse = response;
      writeln(`[AI] ${response}\n`);

      if (autoSpeak && checkTTSAvailability()) {
        writeln("[AUDIO] Speaking response...");
        stopSpeaking();
        void speakText(response, options.voice, options.language).then((didSpeak) => {
          if (didSpeak) writeln("[OK] Done speaking\n");
        }).catch((err) => {
          writeErr(`[FAIL] TTS error: ${err instanceof Error ? err.message : String(err)}\n`);
        });
      }
    } catch (err) {
      writeErr(`[FAIL] ${err instanceof Error ? err.message : String(err)}\n`);
    } finally {
      isProcessing = false;
    }
  };

  // Set up readline prompt
  rl.setPrompt("> You: ");
  rl.prompt();

  const drainInputQueue = async () => {
    if (isDrainingQueue) return;
    isDrainingQueue = true;
    try {
      while (inputQueue.length > 0 && !(rl as any).closed) {
        const nextInput = inputQueue.shift()!;
        if (isProcessing) {
          writeln("[INFO] Previous request is still running; queued your message.");
        }
        await processInput(nextInput);
        if (!(rl as any).closed) rl.prompt();
      }
    } finally {
      isDrainingQueue = false;
    }
  };

  rl.on("line", (line) => {
    const command = line.trim().toLowerCase();
    if (command === "exit" || command === "quit") {
      rl.close();
      return;
    }
    if (command === "stop speaking") {
      writeln(stopSpeaking() ? "[MUTE] Speech stopped." : "[INFO] Nothing is being spoken.");
      rl.prompt();
      return;
    }
    if (command === "mute") {
      autoSpeak = false;
      stopSpeaking();
      writeln("[MUTE] Auto-speak disabled");
      rl.prompt();
      return;
    }
    if (command === "unmute") {
      autoSpeak = true;
      writeln("[AUDIO] Auto-speak enabled");
      rl.prompt();
      return;
    }
    inputQueue.push(line);
    void drainInputQueue();
  });

  await new Promise<void>((resolve) => {
    rl.once("close", () => {
      stopSpeaking();
      void core.dispose("cli_voice_complete").finally(() => {
        writeln("\n[EXIT] Voice chat ended");
        reportExitCode(0);
        resolve();
      });
    });
  });
}

export default createVoiceCommand;
