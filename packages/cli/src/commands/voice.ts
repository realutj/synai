/**
 * Voice Chat Command
 * Talk with AI using voice input and get spoken responses
 */

import { Command } from "commander";
import * as readline from "node:readline";
import { spawn, type ChildProcess } from "node:child_process";
import { platform } from "node:os";

let writeln: (str: string) => void = console.log;
let writeErr: (str: string) => void = console.error;

export function setVoiceOutput(
  writeOutput: (str: string) => void,
  writeError: (str: string) => void,
) {
  writeln = writeOutput;
  writeErr = writeError;
}

interface VoiceOptions {
  language?: string;
  voice?: string;
  autoSpeak?: boolean;
  provider?: string;
  model?: string;
  key?: string;
}

/**
 * Create the voice chat command
 */
export function createVoiceCommand(): Command {
  const cmd = new Command("voice");

  cmd
    .description(
      "🎤 Voice chat mode - Talk with AI using your microphone and hear responses",
    )
    .option(
      "-l, --language <code>",
      "Voice recognition language (default: en-US)",
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
  $ synai voice --language tr-TR
  $ synai voice --model claude-3.5-sonnet
  $ synai voice --no-auto-speak

Supported Languages:
  en-US - English (US)
  tr-TR - Turkish
  es-ES - Spanish
  fr-FR - French
  de-DE - German
  ja-JP - Japanese
  zh-CN - Chinese
  ar-SA - Arabic
    `,
    )
    .action(async (options: VoiceOptions) => {
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
    // Linux might have espeak or festival
    return true;
  }
  
  return false;
}

/**
 * Speak text using system TTS
 */
async function speakText(text: string, voice?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const os = platform();
    let ttsProcess: ChildProcess;

    if (os === "win32") {
      // Windows PowerShell TTS
      const psScript = voice
        ? `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SelectVoice('${voice}'); $synth.Speak('${text.replace(/'/g, "''")}'); $synth.Dispose()`
        : `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('${text.replace(/'/g, "''")}'); $synth.Dispose()`;
      
      ttsProcess = spawn("powershell", ["-Command", psScript]);
    } else if (os === "darwin") {
      // macOS 'say' command
      const args = voice ? ["-v", voice, text] : [text];
      ttsProcess = spawn("say", args);
    } else {
      // Linux - try espeak first, fall back to festival
      ttsProcess = spawn("espeak", [text]);
      
      ttsProcess.on("error", () => {
        // Try festival as fallback
        const fallback = spawn("festival", ["--tts"], { stdio: "pipe" });
        if (fallback.stdin) {
          fallback.stdin.write(text);
          fallback.stdin.end();
        }
        fallback.on("close", () => resolve());
        fallback.on("error", reject);
      });
    }

    ttsProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`TTS failed with code ${code}`));
      }
    });

    ttsProcess.on("error", reject);
  });
}

/**
 * List available voices
 */
async function listVoices(): Promise<string[]> {
  return new Promise((resolve) => {
    const os = platform();
    const voices: string[] = [];

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
      
      proc.on("close", () => {
        const lines = output.trim().split("\n");
        const voiceNames = lines.map((l) => l.split(/\s+/)[0]).filter((v) => v);
        resolve(voiceNames);
      });
    } else {
      resolve(["default"]);
    }
  });
}

/**
 * Run voice chat session
 */
async function runVoiceChat(options: VoiceOptions): Promise<void> {
  writeln("🎤 Voice Chat Mode");
  writeln("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Check TTS availability
  if (!checkTTSAvailability()) {
    writeErr(
      "⚠️  Text-to-speech not available on this system.",
    );
    writeln(
      "Voice recognition will work, but responses won't be spoken.\n",
    );
  }

  // Show available voices
  if (options.voice) {
    writeln(`🔊 Voice: ${options.voice}`);
  } else {
    writeln("🔊 Using system default voice");
  }

  writeln(`🌐 Language: ${options.language}`);
  writeln(`🤖 Model: ${options.model || "default"}`);
  writeln(`📢 Auto-speak: ${options.autoSpeak !== false ? "enabled" : "disabled"}\n`);

  writeln("Note: Browser-based speech recognition is not available in terminal.");
  writeln("Voice chat requires running the Web UI or a browser-based interface.\n");

  writeln("💡 To use voice chat:");
  writeln("  1. Run: synai studio");
  writeln("  2. Open the web dashboard");
  writeln("  3. Click the microphone icon to start voice chat\n");

  writeln("Alternatively, you can type your messages here:");
  writeln('(Type "exit" to quit)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let lastResponse = "";
  let autoSpeak = options.autoSpeak !== false;
  let isProcessing = false;

  const processInput = async (input: string) => {
    const text = input.trim().toLowerCase();

    // Handle voice commands
    if (text === "exit" || text === "quit") {
      writeln("\n👋 Ending voice chat session...");
      rl.close();
      process.exit(0);
    }

    if (text === "stop speaking") {
      writeln("🔇 Stopping speech...");
      // In a real implementation, we'd stop the TTS process
      return;
    }

    if (text === "repeat") {
      if (lastResponse) {
        writeln("\n🔊 Repeating last response...");
        if (autoSpeak) {
          try {
            await speakText(lastResponse, options.voice);
          } catch (err) {
            writeErr(`❌ TTS error: ${(err as Error).message}`);
          }
        }
      } else {
        writeln("⚠️  No previous response to repeat");
      }
      return;
    }

    if (text === "mute") {
      autoSpeak = false;
      writeln("🔇 Auto-speak disabled");
      return;
    }

    if (text === "unmute") {
      autoSpeak = true;
      writeln("🔊 Auto-speak enabled");
      return;
    }

    if (!input.trim()) {
      return;
    }

    // Process AI request
    isProcessing = true;
    writeln(`\n💭 You: ${input}`);
    writeln("🤖 AI: Thinking...\n");

    // Simulate AI response (in real implementation, call LLM API)
    const response = await simulateAIResponse(input);
    lastResponse = response;

    writeln(`🤖 AI: ${response}\n`);

    // Speak response if auto-speak is enabled
    if (autoSpeak && checkTTSAvailability()) {
      try {
        writeln("🔊 Speaking response...");
        await speakText(response, options.voice);
        writeln("✓ Done speaking\n");
      } catch (err) {
        writeErr(`❌ TTS error: ${(err as Error).message}\n`);
      }
    }

    isProcessing = false;
  };

  // Set up readline prompt
  rl.setPrompt("💬 You: ");
  rl.prompt();

  rl.on("line", async (line) => {
    if (!isProcessing) {
      await processInput(line);
      if (!rl.closed) {
        rl.prompt();
      }
    }
  });

  rl.on("close", () => {
    writeln("\n👋 Voice chat ended");
    process.exit(0);
  });
}

/**
 * Simulate AI response (placeholder)
 */
async function simulateAIResponse(input: string): Promise<string> {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Simple responses based on input
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes("hello") || lowerInput.includes("hi")) {
    return "Hello! How can I help you today?";
  }

  if (lowerInput.includes("how are you")) {
    return "I'm doing great, thank you for asking! How can I assist you?";
  }

  if (lowerInput.includes("what") && lowerInput.includes("your name")) {
    return "I'm SynAI, your AI coding assistant. I can help you with programming, debugging, and software development.";
  }

  if (lowerInput.includes("code") || lowerInput.includes("program")) {
    return "I'd be happy to help you with coding! What programming task would you like assistance with?";
  }

  if (lowerInput.includes("thank")) {
    return "You're welcome! Let me know if you need anything else.";
  }

  // Default response
  return "I understand. Could you provide more details about what you'd like help with?";
}

export default createVoiceCommand;
