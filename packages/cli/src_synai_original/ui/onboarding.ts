import chalk from 'chalk';
import { select, input } from '@inquirer/prompts';
import { ConfigManager, ApprovalMode, DEFAULT_FREE_MODEL } from '@synai-code/core';
import { getAvailableThemes, setCurrentTheme, getCurrentTheme, CLITheme } from './theme.js';
import { promptForApiKey } from './apiKeyPrompt.js';
import { getTerminalWidth } from './index.js';

export interface OnboardingResult {
  theme: string;
  apiKey: string;
  model: string;
  mode: ApprovalMode;
}

export async function runOnboardingWizard(
  configManager: ConfigManager,
  options: { isFirstRun?: boolean } = {}
): Promise<OnboardingResult> {
  const width = getTerminalWidth();
  const currentCfg = configManager.getConfig();
  const initialTheme = getCurrentTheme();

  // Welcome header
  console.log('');
  console.log(`${initialTheme.accent(initialTheme.spark)} ${chalk.bold('Welcome to SynAI!')}`);
  console.log(chalk.dim('Let\'s set up your workspace and personal preferences.'));
  console.log(chalk.dim('─'.repeat(Math.min(width, 60))));
  console.log('');

  // 1. THEME SELECTION
  const availableThemes = getAvailableThemes();
  const themeChoices = availableThemes.map((t) => ({
    name: `${t.preview}  ${chalk.bold.white(t.name.padEnd(26))} ${chalk.dim(t.description)}`,
    value: t.id,
  }));

  // Explicit type argument: `@inquirer/select`'s `choices` parameter is a union of
  // array shapes, which blocks inference of its `<Value>` generic (it silently
  // resolves to `unknown`). Naming the type here keeps everything downstream `string`.
  const selectedThemeId = await select<string>({
    message: 'Step 1/4: Choose your color theme:',
    choices: themeChoices,
    default: currentCfg.theme || 'dark',
  });

  const activeTheme = setCurrentTheme(selectedThemeId);
  console.log(activeTheme.success(`  ✓ Theme applied: ${chalk.bold(activeTheme.name)}\n`));

  // 2. OPENROUTER API KEY (MANDATORY WITH 1-CLICK CLIPBOARD PASTE)
  const apiKey = await promptForApiKey({
    currentKey: currentCfg.apiKey,
    stepPrefix: 'Step 2/4: ',
  });

  // 3. DEFAULT MODEL SELECTION
  const modelChoices = [
    {
      name: `${chalk.bold.white('cohere/north-mini-code:free')} ${chalk.green('[Free]')} — Coding agent (Recommended)`,
      value: 'cohere/north-mini-code:free',
    },
    {
      name: `${chalk.bold.white('poolside/laguna-s-2.1:free')} ${chalk.green('[Free]')} — Frontier coding agent (70.2% TB2.1)`,
      value: 'poolside/laguna-s-2.1:free',
    },
    {
      name: `${chalk.bold.white('nex-agi/nex-n2.5-pro:free')} ${chalk.green('[Free]')} — Autonomous agentic coding`,
      value: 'nex-agi/nex-n2.5-pro:free',
    },
    {
      name: `${chalk.bold.white('nvidia/nemotron-3.5-lightning:free')} ${chalk.green('[Free]')} — High throughput (1M context)`,
      value: 'nvidia/nemotron-3.5-lightning:free',
    },
    {
      name: `${chalk.bold.white('google/gemma-4-31b-it:free')} ${chalk.green('[Free]')} — Dense multimodal reasoning`,
      value: 'google/gemma-4-31b-it:free',
    },
    {
      name: `${chalk.bold.white('openrouter/free')} ${chalk.green('[Free]')} — Auto-routed free model`,
      value: 'openrouter/free',
    },
    {
      name: `${chalk.dim('[Custom Model Identifier...]')}`,
      value: '__custom__',
    },
  ];

  let selectedModel = await select<string>({
    message: 'Step 3/4: Choose default AI Model:',
    choices: modelChoices,
    default: currentCfg.model || DEFAULT_FREE_MODEL,
  });

  if (selectedModel === '__custom__') {
    const customId = await input({
      message: 'Enter OpenRouter model ID (e.g. cohere/north-mini-code:free):',
      validate: (v) => (v.trim().length > 0 ? true : 'Model ID is required'),
    });
    selectedModel = customId.trim();
  }

  console.log(activeTheme.success(`  ✓ Default model: ${chalk.bold(selectedModel)}\n`));

  // 4. PERMISSION MODE
  const selectedMode = await select<ApprovalMode>({
    message: 'Step 4/4: Choose Permission Mode:',
    choices: [
      {
        name: `${chalk.bold.white('default')} (Recommended) — Ask before file edits and bash commands`,
        value: 'confirm' as ApprovalMode,
      },
      {
        name: `${chalk.bold.white('acceptEdits')} — Auto-approve file edits, ask for bash commands`,
        value: 'auto' as ApprovalMode,
      },
      {
        name: `${chalk.bold.white('plan')} — Read-only mode, no modifications`,
        value: 'dry-run' as ApprovalMode,
      },
    ],
    default: currentCfg.mode || 'confirm',
  });

  console.log(activeTheme.success(`  ✓ Permission mode: ${chalk.bold(selectedMode)}\n`));

  // SAVE CONFIGURATION
  configManager.saveGlobalConfig({
    theme: selectedThemeId,
    apiKey,
    defaultModel: selectedModel,
    defaultMode: selectedMode,
    hasConfigured: true,
  });

  // Completion summary
  console.log(chalk.dim('─'.repeat(Math.min(width, 60))));
  console.log(`${activeTheme.accent(activeTheme.spark)} ${chalk.bold('Configuration saved!')}`);
  console.log(`  ${chalk.dim('Theme:')}    ${activeTheme.name}`);
  console.log(`  ${chalk.dim('Model:')}    ${selectedModel}`);
  console.log(`  ${chalk.dim('Mode:')}     ${selectedMode}`);
  console.log(`  ${chalk.dim('API Key:')} Configured (•••)`);
  console.log('');
  console.log(chalk.dim('Tip: Use /help for commands, Shift+Tab to switch modes'));
  console.log('');

  return {
    theme: selectedThemeId,
    apiKey,
    model: selectedModel,
    mode: selectedMode,
  };
}
