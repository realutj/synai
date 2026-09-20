#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { SynAIRepl } from './repl/index.js';
import { OpenRouterClient, ConfigManager, SynAIServer, ApprovalMode, DEFAULT_FREE_MODEL, normalizeThinkingLevel } from '@synai-code/core';
import {
  printModelsTable,
  centerText,
  getTerminalWidth,
  getCurrentTheme,
  setCurrentTheme,
  getTheme,
  getAvailableThemes,
  runOnboardingWizard,
  promptForApiKey,
  formatTurnFooter,
} from './ui/index.js';
import { handleSigint } from './utils/sigint.js';
import { resolveWebStaticDir } from './utils/web.js';

// Global crash guards with beautiful error formatting
process.on('uncaughtException', (err) => {
  const width = getTerminalWidth();
  console.log('');
  console.error(centerText(chalk.bold.white('⚠ Uncaught Exception'), width));
  console.error(centerText(chalk.white(err.message), width));
  if (err.stack) {
    const stack = err.stack.split('\n').slice(1, 4).join('\n');
    console.error(centerText(chalk.dim(stack), width));
  }
  console.error(centerText(chalk.dim('The session will continue. Type your next prompt.'), width));
  console.log('');
});

process.on('unhandledRejection', (reason: any) => {
  const width = getTerminalWidth();
  const msg = reason?.message || String(reason);
  console.log('');
  console.error(centerText(chalk.bold.white('⚠ Unhandled Promise Rejection'), width));
  console.error(centerText(chalk.gray(msg), width));
  console.error(centerText(chalk.dim('The session will continue. Type your next prompt.'), width));
  console.log('');
});

// Handle graceful shutdown - 2x Ctrl+C to exit
process.on('SIGINT', () => {
  handleSigint();
});

process.on('SIGTERM', () => {
  const width = getTerminalWidth();
  console.log('\n');
  console.log(centerText(chalk.dim('Received termination signal...'), width));
  console.log(centerText(chalk.dim('✨ Goodbye!'), width));
  console.log('');
  process.exit(0);
});

const program = new Command();

program
  .name('synai')
  .description(chalk.dim('SynAI — Open-Source AI Coding Assistant (CLI + Web) powered by OpenRouter'))
  .version('1.1.2', '-v, --version', 'Display current SynAI version')
  .helpOption('-h, --help', 'Display detailed help manual and command index')
  .addHelpText('before', () => {
    const theme = getCurrentTheme();
    const spark = theme.spark || '*';
    return `\n  ${theme.accent(spark)} ${chalk.bold(theme.primary('SynAI'))} ${chalk.dim('v1.1.2 — Open-Source AI Coding Assistant (CLI + Web) powered by OpenRouter')}\n` +
      `  ${chalk.dim('Autonomous AI Coding Assistant & Software Engineering Partner')}\n`;
  })
  .addHelpText('after', `

${chalk.bold('Examples:')}
  ${chalk.white('$')} synai ${chalk.dim('# Start interactive REPL with first-time setup')}
  ${chalk.white('$')} synai -p "Explain this project" ${chalk.dim('# Print mode: write response to stdout and exit')}
  ${chalk.white('$')} synai -c ${chalk.dim('# Continue the most recent conversation')}
  ${chalk.white('$')} synai -r 123456 ${chalk.dim('# Resume conversation by ID')}
  ${chalk.white('$')} synai theme matrix ${chalk.dim('# Switch theme to Hacker Matrix')}
  ${chalk.white('$')} synai init ${chalk.dim('# Run interactive setup wizard & create SYNAI.md')}
  ${chalk.white('$')} synai "Create a REST API" ${chalk.dim('# Execute immediate task')}
  ${chalk.white('$')} synai web ${chalk.dim('# Launch Web UI')}

${chalk.bold('Documentation:')}
  ${chalk.white('https://github.com/synai/synai')}
`);

program
  .argument('[prompt...]', 'Initial instruction or prompt to execute immediately')
  .option('-p, --print <prompt>', 'Run non-interactively, print response to stdout, and exit')
  .option('-c, --continue', 'Continue the most recent conversation')
  .option('-r, --resume <id>', 'Resume a specific conversation by ID')
  .option('--permission-mode <mode>', 'Permission mode: default | acceptEdits | plan | auto')
  .option('--allowedTools <tools>', 'Pre-authorize specific tools (comma-separated)')
  .option('--output-format <format>', 'Output format for -p mode: text | json | stream-json')
  .option('--append-system-prompt <prompt>', 'Append to system prompt')
  .option('--bare', 'Minimal startup — skip SYNAI.md, onboarding')
  .option('-m, --model <model>', 'OpenRouter model ID (e.g., cohere/north-mini-code:free)')
  .option('--mode <mode>', 'Approval mode: auto | confirm | dry-run (default: confirm)')
  .option('-e, --effort <level>', 'Thinking effort: low | medium | high | max')
  .option('--thinking <level>', 'Thinking level: low | medium | high | max')
  .option('-t, --theme <theme>', 'CLI color theme (dark | light | dark-daltonized | light-daltonized | dark-ansi | light-ansi)')
  .option('-k, --api-key <key>', 'OpenRouter API Key for authentication')
  .option('-w, --workspace <path>', 'Workspace directory path (defaults to current directory)')
  .option('--no-banner', 'Disable startup banner and branding')
  .option('--incognito, --ephemeral', 'Private session: do not save conversation history or memory to disk')
  .option('--json', 'Output results in JSON format (for scripting)')
  .option('--verbose', 'Enable verbose logging and debug output')
  .action(async (promptParts: string[], options) => {
    const workspace = options.workspace || process.cwd();
    const configManager = new ConfigManager(workspace);
    const cfg = configManager.getConfig();

    // Apply stored or option theme
    if (options.theme) {
      setCurrentTheme(options.theme);
      configManager.updateConfig({ theme: options.theme });
    } else if (cfg.theme) {
      setCurrentTheme(cfg.theme);
    }

    const modeMap: Record<string, string> = {
      'default': 'confirm',
      'acceptEdits': 'auto', 
      'plan': 'dry-run',
      'auto': 'auto',
    };
    if (options.permissionMode) {
      configManager.updateConfig({ mode: (modeMap[options.permissionMode] || 'confirm') as ApprovalMode });
    }

    // Interactive first-run wizard if not configured yet
    if (!options.bare && configManager.isFirstRun() && process.stdin.isTTY && promptParts.length === 0 && !options.json && !options.noBanner && !options.print) {
      await runOnboardingWizard(configManager, { isFirstRun: true });
    }

    // Apply runtime configuration overrides
    if (options.model) configManager.updateConfig({ model: options.model });
    if (options.mode) configManager.updateConfig({ mode: options.mode as ApprovalMode });
    if (options.apiKey) configManager.updateConfig({ apiKey: options.apiKey });
    if (options.thinking || options.effort) {
      const lvl = normalizeThinkingLevel(options.thinking || options.effort);
      configManager.updateConfig({ thinkingLevel: lvl });
    }

    // Ensure OpenRouter API key is entered before proceeding
    let activeApiKey = (options.apiKey || configManager.getConfig().apiKey || process.env.OPENROUTER_API_KEY || '').trim();

    if (!activeApiKey) {
      if (process.stdin.isTTY && !options.print && !options.json) {
        console.log('');
        console.log(chalk.yellow.bold('⚠️  OpenRouter API Key gerekli!'));
        console.log(chalk.dim('SynAI kodlama asistanını kullanabilmek için geçerli bir API anahtarı girmelisiniz.'));
        console.log(chalk.dim('Anahtarınızı https://openrouter.ai/keys adresinden ücretsiz alabilirsiniz.'));

        activeApiKey = await promptForApiKey();

        configManager.updateConfig({ apiKey: activeApiKey });
        configManager.saveGlobalConfig({ apiKey: activeApiKey, hasConfigured: true });
        configManager.saveLocalConfig({ apiKey: activeApiKey });
        process.env.OPENROUTER_API_KEY = activeApiKey;
        console.log(chalk.green('✓ API anahtarı kaydedildi. Oturum başlatılıyor...\n'));
      } else {
        console.error(chalk.red.bold('\n❌ Hata: OpenRouter API Key tanımlı değil.'));
        console.error(chalk.yellow('API anahtarı girmeden SynAI ilerletilemez.'));
        console.error(chalk.dim('Lütfen \'synai config --api-key <key>\' çalıştırın veya ortam değişkenine OPENROUTER_API_KEY ekleyin.\n'));
        process.exit(1);
      }
    }

    let initialPrompt: string | undefined = promptParts.length > 0 ? promptParts.join(' ') : undefined;
    
    // Handle continue/resume
    let resumeId: string | undefined = options.resume;
    if (options.continue) {
      const coreModule = await import('@synai-code/core');
      const storage = new coreModule.StorageManager();
      const conversations = storage.listConversations();
      if (conversations.length > 0) {
        resumeId = conversations[0].id;
        initialPrompt = undefined;
      }
    }

    if (options.print) {
      // Non-interactive mode
      const repl = new SynAIRepl(workspace, {
        noBanner: true,
        jsonOutput: options.outputFormat === 'json',
        verbose: options.verbose,
      });
      // Configure
      repl['agent'].setConfig({
        ...(options.model ? { model: options.model } : {}),
        ...(options.mode ? { mode: options.mode as ApprovalMode } : {}),
        ...(options.apiKey ? { apiKey: options.apiKey } : {}),
        incognito: Boolean(options.incognito || options.ephemeral),
        thinkingLevel: configManager.getConfig().thinkingLevel || 'medium',
      });
      
      try {
        await repl.handleUserPrompt(options.print);
      } catch (error: any) {
        console.error(error.message);
        process.exit(1);
      }
      process.exit(0);
    }

    if (!process.stdin.isTTY && !options.print) {
      // Read from stdin pipe
      let stdinData = '';
      process.stdin.setEncoding('utf-8');
      for await (const chunk of process.stdin) {
        stdinData += chunk;
      }
      if (stdinData.trim()) {
        // Treat piped input as a prompt
        const repl = new SynAIRepl(workspace, { noBanner: true });
        await repl.handleUserPrompt(stdinData.trim());
        process.exit(0);
      }
    }

    const repl = new SynAIRepl(workspace, {
      noBanner: options.noBanner || options.bare,
      jsonOutput: options.json,
      verbose: options.verbose,
      ...(resumeId ? { resumeId } : {})
    } as any);

    // Configure agent with runtime options
    repl['agent'].setConfig({
      ...(options.model ? { model: options.model } : {}),
      ...(options.mode ? { mode: options.mode as ApprovalMode } : {}),
      ...(options.permissionMode ? { mode: (modeMap[options.permissionMode] || 'confirm') as ApprovalMode } : {}),
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      ...(options.theme ? { theme: options.theme } : {}),
      incognito: Boolean(options.incognito || options.ephemeral),
      thinkingLevel: configManager.getConfig().thinkingLevel || 'medium',
    });

    try {
      await repl.start(initialPrompt);
    } catch (error: any) {
      const width = getTerminalWidth();
      console.log('');
      console.error(centerText(chalk.bold.white('❌ Fatal Error'), width));
      console.error(centerText(chalk.white(error.message || 'Unknown error occurred'), width));
      if (options.verbose && error.stack) {
        console.error(centerText(chalk.dim(error.stack), width));
      }
      console.log('');
      process.exit(1);
    }
  });

program
  .command('web')
  .description('Launch the SynAI Web Interface in your default browser')
  .option('-p, --port <port>', 'Port number to listen on (default: 4242)', '4242')
  .option('-H, --host <host>', 'Host to bind server (default: localhost)', 'localhost')
  .option('-w, --workspace <path>', 'Workspace directory path', process.cwd())
  .option('--no-open', 'Don\'t automatically open browser')
  .option('--cors', 'Enable CORS for external access')
  .action(async (options) => {
    const width = getTerminalWidth();
    const spinner = ora({
      text: 'Starting SynAI Web Server...',
      spinner: 'dots',
      color: 'white',
    }).start();

    try {
      const server = new SynAIServer({
        port: parseInt(options.port, 10),
        host: options.host,
        workspaceRoot: options.workspace,
        staticDir: resolveWebStaticDir(),
      });

      const { url } = await server.start();
      spinner.succeed(chalk.white('✓ SynAI Web Server is running'));
      
      console.log('');
      console.log(centerText(chalk.bold.white('╔═══════════════════════════════════════════╗'), width));
      console.log(centerText(chalk.bold.white('║') + '  ' + chalk.bold.white('SynAI Web Dashboard Active') + '           ' + chalk.bold.white('║'), width));
      console.log(centerText(chalk.bold.white('╚═══════════════════════════════════════════╝'), width));
      console.log('');
      console.log(centerText(`${chalk.dim('URL:')}        ${chalk.white.bold.underline(url)}`, width));
      console.log(centerText(`${chalk.dim('Workspace:')} ${chalk.white(options.workspace)}`, width));
      console.log(centerText(`${chalk.dim('Host:')}      ${chalk.white(options.host)}:${chalk.white(options.port)}`, width));
      console.log('');
      console.log(centerText(chalk.dim('Press Ctrl+C to stop the server'), width));
      console.log('');

      if (options.open) {
        await open(url);
        console.log(centerText(chalk.dim('✓ Browser opened automatically'), width));
        console.log('');
      }

      // Keep process alive
      await new Promise(() => {});
    } catch (err: any) {
      spinner.fail(chalk.white('✗ Failed to start server'));
      console.log('');
      console.error(centerText(chalk.white(`Error: ${err.message}`), width));
      
      if (err.code === 'EADDRINUSE') {
        console.error(centerText(chalk.gray(`Port ${options.port} is already in use. Try a different port with -p <port>`), width));
      } else if (err.code === 'EACCES') {
        console.error(centerText(chalk.gray('Permission denied. Try using a port number above 1024.'), width));
      }
      console.log('');
      process.exit(1);
    }
  });

program
  .command('models')
  .alias('m')
  .description('List and inspect available OpenRouter AI models')
  .option('-k, --api-key <key>', 'OpenRouter API Key for authentication')
  .option('--free', 'Show only free models')
  .option('--paid', 'Show only paid models')
  .option('--filter <text>', 'Filter models by name or provider')
  .option('--sort <field>', 'Sort by: name | context | price (default: name)')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    const width = getTerminalWidth();
    const configManager = new ConfigManager();
    const cfg = configManager.getConfig();
    const client = new OpenRouterClient(options.apiKey || cfg.apiKey);

    const spinner = ora({
      text: 'Fetching OpenRouter models...',
      spinner: 'dots',
      color: 'white',
    }).start();

    try {
      let models = await client.fetchAvailableModels();
      
      // Apply filters
      if (options.free) {
        models = models.filter((m: any) => m.isFree);
      }
      if (options.paid) {
        models = models.filter((m: any) => !m.isFree);
      }
      if (options.filter) {
        const filter = options.filter.toLowerCase();
        models = models.filter((m: any) => 
          m.id.toLowerCase().includes(filter) || 
          m.name?.toLowerCase().includes(filter)
        );
      }

      // Apply sorting
      if (options.sort) {
        const sortField = options.sort.toLowerCase();
        if (sortField === 'context') {
          models.sort((a: any, b: any) => b.context_length - a.context_length);
        } else if (sortField === 'price') {
          models.sort((a: any, b: any) => (a.isFree ? 0 : 1) - (b.isFree ? 0 : 1));
        } else {
          models.sort((a: any, b: any) => a.id.localeCompare(b.id));
        }
      }

      spinner.succeed(chalk.white(`✓ Found ${models.length} models`));
      console.log('');

      if (options.json) {
        console.log(JSON.stringify(models, null, 2));
      } else {
        printModelsTable(models, cfg.model);
        console.log(centerText(chalk.dim('Use: synai -m <model_id> to switch models'), width));
        console.log('');
      }
    } catch (err: any) {
      spinner.fail(chalk.white('✗ Failed to fetch models'));
      console.log('');
      console.error(centerText(chalk.white(`Error: ${err.message}`), width));
      
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        console.error(centerText(chalk.gray('API key is invalid or missing. Configure with: synai config -k YOUR_KEY'), width));
      }
      console.log('');
      process.exit(1);
    }
  });

program
  .command('config')
  .alias('cfg')
  .description('View or modify global SynAI configuration')
  .option('-k, --key <key>', 'Set OpenRouter API Key')
  .option('-m, --model <model>', 'Set default model ID')
  .option('--mode <mode>', 'Set default approval mode (auto | confirm | dry-run)')
  .option('-e, --effort <level>', 'Set default thinking effort (low | medium | high | max)')
  .option('--thinking <level>', 'Set default thinking level (low | medium | high | max)')
  .option('-t, --theme <theme>', 'Set default CLI color theme (dark | light | dark-daltonized | light-daltonized | dark-ansi | light-ansi)')
  .option('--reset', 'Reset all configuration to defaults')
  .option('--show', 'Display full configuration (including hidden values)')
  .option('--json', 'Output configuration in JSON format')
  .action((options, cmd) => {
    const width = getTerminalWidth();
    const configManager = new ConfigManager();

    if (options.reset) {
      // Reset configuration
      configManager.saveGlobalConfig({
        apiKey: '',
        defaultModel: DEFAULT_FREE_MODEL,
        defaultMode: 'confirm' as ApprovalMode,
        defaultThinkingLevel: 'medium',
        thinkingLevel: 'medium',
        theme: 'dark',
      });
      console.log('');
      console.log(centerText(chalk.white('✓ Configuration reset to defaults'), width));
      console.log('');
      return;
    }

    const globals = cmd && typeof cmd.optsWithGlobals === 'function' ? cmd.optsWithGlobals() : {};
    const key = options.key || options.apiKey || globals.apiKey;
    const model = options.model || globals.model;
    const mode = options.mode || globals.mode;
    const theme = options.theme || globals.theme;
    let thinking = options.thinking || options.effort || globals.thinking || globals.effort;
    if (thinking) {
      thinking = normalizeThinkingLevel(thinking);
    }

    if (key || model || mode || theme || thinking) {
      // Save new configuration
      const updates: any = {};
      if (key) updates.apiKey = key;
      if (model) updates.defaultModel = model;
      if (mode) updates.defaultMode = mode as ApprovalMode;
      if (theme) updates.theme = theme;
      if (thinking) {
        updates.defaultThinkingLevel = thinking;
        updates.thinkingLevel = thinking;
      }
      
      configManager.saveGlobalConfig(updates);
      if (theme) {
        setCurrentTheme(theme);
      }
      
      console.log('');
      console.log(centerText(chalk.white('✓ Configuration saved successfully'), width));
      console.log('');
      
      if (key) {
        console.log(centerText(chalk.dim('API Key:       ') + chalk.white('Updated (•••)'), width));
      }
      if (model) {
        console.log(centerText(chalk.dim('Default Model: ') + chalk.white(model), width));
      }
      if (mode) {
        console.log(centerText(chalk.dim('Approval Mode: ') + chalk.gray(mode), width));
      }
      if (thinking) {
        console.log(centerText(chalk.dim('Thinking Lvl:  ') + chalk.white(thinking), width));
      }
      if (theme) {
        console.log(centerText(chalk.dim('CLI Theme:     ') + chalk.white(theme), width));
      }
      console.log('');
    } else {
      // Display current configuration
      const cfg = configManager.getConfig();
      
      if (options.json) {
        const output = {
          model: cfg.model,
          mode: cfg.mode,
          thinkingLevel: cfg.thinkingLevel || 'medium',
          theme: cfg.theme || 'cyan',
          apiKey: cfg.apiKey ? '***' : null,
          port: cfg.port,
          workspaceRoot: cfg.workspaceRoot,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      console.log('');
      console.log(centerText(chalk.bold.white('╔═══════════════════════════════════════════╗'), width));
      console.log(centerText(chalk.bold.white('║') + '  ' + chalk.bold.white('SynAI Configuration') + '                  ' + chalk.bold.white('║'), width));
      console.log(centerText(chalk.bold.white('╚═══════════════════════════════════════════╝'), width));
      console.log('');
      console.log(centerText(`${chalk.dim('Default Model:')}  ${chalk.white(cfg.model)}`, width));
      console.log(centerText(`${chalk.dim('Approval Mode:')}  ${chalk.white(cfg.mode)}`, width));
      console.log(centerText(`${chalk.dim('Thinking Lvl:')}   ${chalk.white(cfg.thinkingLevel || 'medium')}`, width));
      console.log(centerText(`${chalk.dim('CLI Theme:')}      ${chalk.white(cfg.theme || 'cyan')}`, width));
      
      if (options.show && cfg.apiKey) {
        console.log(centerText(`${chalk.dim('API Key:')}        ${chalk.gray(cfg.apiKey)}`, width));
      } else {
        console.log(centerText(`${chalk.dim('API Key:')}        ${cfg.apiKey ? chalk.white('Configured (•••)') : chalk.dim('None (using free tier)')}`, width));
      }
      
      console.log(centerText(`${chalk.dim('Web Port:')}       ${chalk.white(cfg.port)}`, width));
      console.log(centerText(`${chalk.dim('Workspace:')}      ${chalk.white(cfg.workspaceRoot)}`, width));
      console.log('');
      console.log(centerText(chalk.dim('Use --reset to restore defaults, or --help for options'), width));
      console.log('');
    }
  });

// Add new commands
program
  .command('doctor')
  .alias('check')
  .description('Run system diagnostics and health checks')
  .action(async () => {
    const width = getTerminalWidth();
    const configManager = new ConfigManager();
    const cfg = configManager.getConfig();

    console.log('');
    console.log(centerText(chalk.bold('🔍 Running SynAI System Diagnostics...'), width));
    console.log('');

    const checks = [
      { name: 'Node.js Version', check: () => process.version, expected: '>=18.0.0' },
      { name: 'Configuration File', check: () => cfg ? '✓' : '✗', expected: 'Valid' },
      { name: 'API Key', check: () => cfg.apiKey ? '✓ Configured' : '✗ Missing (Required)', expected: 'Required' },
      { name: 'Thinking Level', check: () => cfg.thinkingLevel || 'medium', expected: 'Active' },
      { name: 'Workspace Access', check: () => cfg.workspaceRoot ? '✓' : '✗', expected: 'Readable' },
    ];

    for (const { name, check, expected } of checks) {
      const spinner = ora(name).start();
      await new Promise(resolve => setTimeout(resolve, 300));
      try {
        const result = check();
        spinner.succeed(`${chalk.dim(name + ':')} ${chalk.white(result)}`);
      } catch (err: any) {
        spinner.fail(`${chalk.dim(name + ':')} ${chalk.white(err.message)}`);
      }
    }

    console.log('');
    console.log(centerText(chalk.white('✓ System diagnostics complete'), width));
    console.log('');
  });

program
  .command('init')
  .description('Initialize project configuration and generate SYNAI.md')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (options) => {
    const configManager = new ConfigManager();

    if (options.yes) {
      configManager.saveGlobalConfig({
        defaultModel: DEFAULT_FREE_MODEL,
        defaultMode: 'confirm' as ApprovalMode,
        apiKey: '',
        theme: 'cyan',
        hasConfigured: true,
      });
      console.log(chalk.green('\n✓ SynAI workspace initialized with default settings.\n'));
    } else {
      await runOnboardingWizard(configManager);
    }
    
    // Also create SYNAI.md if it doesn't exist
    const synaiMdPath = path.join(process.cwd(), 'SYNAI.md');
    if (!fs.existsSync(synaiMdPath)) {
      const defaultContent = `# Project Guidelines\n\n## Build & Test Commands\n- Build: \`npm run build\`\n- Test: \`npm test\`\n\n## Code Style\n- Follow existing patterns\n- Use TypeScript strict mode\n`;
      fs.writeFileSync(synaiMdPath, defaultContent, 'utf-8');
      console.log(chalk.dim('✓ Created SYNAI.md with default project guidelines'));
    }
  });

program
  .command('theme [themeId]')
  .description('View or switch CLI color theme')
  .option('-l, --list', 'List all available themes')
  .action(async (themeId, options) => {
    const configManager = new ConfigManager();
    const cfg = configManager.getConfig();
    if (cfg.theme) {
      setCurrentTheme(cfg.theme);
    }
    const currentTheme = getCurrentTheme();

    if (options.list || (!themeId && !process.stdin.isTTY)) {
      console.log('\n' + chalk.bold.white('Available SynAI Themes:') + '\n');
      for (const t of getAvailableThemes()) {
        const isCur = t.id === currentTheme.id;
        const mark = isCur ? chalk.green('● ') : chalk.dim('○ ');
        console.log(`  ${mark}${t.preview}  ${chalk.bold(t.name.padEnd(26))} ${chalk.dim(t.description)}`);
      }
      console.log('\n' + chalk.dim('Usage: synai theme <themeId> to apply\n'));
      return;
    }

    if (themeId) {
      const target = getTheme(themeId);
      setCurrentTheme(target.id);
      configManager.saveGlobalConfig({ theme: target.id });
      console.log('\n' + target.success(`✓ Theme switched to: ${chalk.bold(target.name)}`) + '\n');
      return;
    }

    // Interactive picker if no theme ID given
    const { select } = await import('@inquirer/prompts');
    const picked = await select<string>({
      message: 'Choose a CLI Color Theme:',
      choices: getAvailableThemes().map((t) => ({
        name: `${t.preview}  ${chalk.bold.white(t.name.padEnd(26))} ${chalk.dim(t.description)}`,
        value: t.id,
      })),
      default: currentTheme.id,
    });

    const active = setCurrentTheme(picked);
    configManager.saveGlobalConfig({ theme: picked });
    console.log('\n' + active.success(`✓ Theme switched to: ${chalk.bold(active.name)}`) + '\n');
  });

program.parse(process.argv);
