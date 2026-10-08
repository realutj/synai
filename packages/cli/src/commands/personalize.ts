import { Command } from "commander";
import {
  getPersonalizationProfile,
  savePersonalizationProfile,
  resetPersonalizationProfile,
  type PersonalizationProfile,
} from "@synai/core";

export function createPersonalizeCommand(ctx?: { exitCode?: number }): Command {
  const markHandled = () => {
    if (ctx) ctx.exitCode = 0;
  };

  const cmd = new Command("persona")
    .alias("personalize")
    .description("Manage user profile, communication tone, and custom instructions")
    .action(async () => {
      markHandled();
      await showPersonaProfile();
    });

  cmd
    .command("show")
    .description("Display active personalization profile and preferences")
    .option("-w, --workspace", "Inspect workspace-specific profile")
    .action(async (opts: { workspace?: boolean }) => {
      markHandled();
      await showPersonaProfile(opts.workspace ? process.cwd() : undefined);
    });

  cmd
    .command("set")
    .description("Update personalization preferences")
    .option("-n, --name <name>", "Preferred user name or title")
    .option("-r, --role <role>", "Developer role or domain expertise")
    .option("-l, --lang <language>", "Preferred response language (e.g. English)")
    .option("-t, --tone <tone>", "Communication tone (concise, detailed, friendly, formal, mentor)")
    .option("-s, --style <style>", "Coding style preferences")
    .option("-i, --instructions <instructions>", "Custom system instructions applied in every session")
    .option("--stack <items>", "Preferred technologies (comma-separated)")
    .option("-w, --workspace", "Save preferences only for the current workspace")
    .action(async (opts: {
      name?: string;
      role?: string;
      lang?: string;
      tone?: string;
      style?: string;
      instructions?: string;
      stack?: string;
      workspace?: boolean;
    }) => {
      markHandled();
      const updates: Partial<PersonalizationProfile> = {};
      if (opts.name !== undefined) updates.name = opts.name;
      if (opts.role !== undefined) updates.role = opts.role;
      if (opts.lang !== undefined) updates.language = opts.lang;
      if (opts.tone !== undefined) updates.tone = opts.tone;
      if (opts.style !== undefined) updates.codingStyle = opts.style;
      if (opts.instructions !== undefined) updates.customInstructions = opts.instructions;
      if (opts.stack !== undefined) {
        updates.techStack = opts.stack.split(",").map((s) => s.trim()).filter(Boolean);
      }

      const wsRoot = opts.workspace ? process.cwd() : undefined;
      const updated = savePersonalizationProfile(updates, wsRoot);
      console.log("\n[OK] Personalization preferences saved successfully.\n");
      printProfile(updated, wsRoot);
    });

  cmd
    .command("reset")
    .description("Reset personalization profile to default settings")
    .option("-w, --workspace", "Reset only the current workspace profile")
    .action((opts: { workspace?: boolean }) => {
      markHandled();
      const wsRoot = opts.workspace ? process.cwd() : undefined;
      resetPersonalizationProfile(wsRoot);
      console.log("\n[OK] Personalization profile reset to defaults.\n");
    });

  return cmd;
}

async function showPersonaProfile(workspaceRoot?: string): Promise<void> {
  const profile = getPersonalizationProfile(workspaceRoot);
  console.log("\n[*] SynAI Personalization & User Profile");
  console.log("--------------------------------------------------");
  printProfile(profile, workspaceRoot);
}

function printProfile(profile: PersonalizationProfile, workspaceRoot?: string): void {
  console.log(`  Name / Title       : ${profile.name || "(Not set)"}`);
  console.log(`  Role / Expertise   : ${profile.role || "(Not set)"}`);
  console.log(`  Preferred Language : ${profile.language || "English"}`);
  console.log(`  Communication Tone : ${profile.tone || "concise"}`);
  console.log(`  Tech Stack         : ${profile.techStack?.join(", ") || "(General)"}`);
  console.log(`  Coding Style       : ${profile.codingStyle || "(Default clean code)"}`);
  console.log(`  Custom Directives  : ${profile.customInstructions || "(None)"}`);
  console.log("--------------------------------------------------");
  console.log(`  Scope              : ${workspaceRoot ? "Workspace (.synai/persona.json)" : "Global (~/.synai/persona.json)"}\n`);
}
