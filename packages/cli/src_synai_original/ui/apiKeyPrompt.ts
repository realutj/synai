import chalk from 'chalk';
import { select, input } from '@inquirer/prompts';
import open from 'open';
import { getClipboardText } from '../utils/clipboard.js';

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '(yok)';
  if (trimmed.length <= 12) return '••••••••';
  return `${trimmed.slice(0, 10)}••••••••${trimmed.slice(-4)}`;
}

export function isApiKeyLike(key: string): boolean {
  const trimmed = key.trim();
  if (trimmed.length < 15) return false;
  if (trimmed.includes('\n') || trimmed.includes('\r')) return false;
  return true;
}

export interface PromptApiKeyOptions {
  currentKey?: string;
  stepPrefix?: string;
}

/**
 * Interactive API key prompt that provides 1-click clipboard paste,
 * right-click manual paste, and browser opening to eliminate terminal paste issues.
 */
export async function promptForApiKey(options: PromptApiKeyOptions = {}): Promise<string> {
  const { currentKey, stepPrefix = '' } = options;

  while (true) {
    const rawClipboard = getClipboardText().trim();
    const hasLikelyKeyInClipboard = isApiKeyLike(rawClipboard);

    const choices: Array<{ name: string; value: string }> = [];

    if (currentKey && currentKey.trim()) {
      choices.push({
        name: `${chalk.bold.white('✓ Mevcut anahtarı koru')} ${chalk.dim(`(${maskApiKey(currentKey)})`)}`,
        value: 'keep',
      });
    }

    if (hasLikelyKeyInClipboard) {
      choices.push({
        name: `${chalk.bold.green('📋 Panodaki anahtarı yapıştır')} ${chalk.dim(`(${maskApiKey(rawClipboard)})`)} ${chalk.cyan('[Önerilen / Tek tık]')}`,
        value: 'use_clipboard',
      });
    } else {
      choices.push({
        name: `${chalk.bold.cyan('📋 Panodan Yapıştır')} ${chalk.dim('(Panodaki metni otomatik oku)')}`,
        value: 'read_clipboard',
      });
    }

    choices.push({
      name: `${chalk.bold.white('⌨️  Konsola yaz / Sağ tık ile yapıştır')}`,
      value: 'manual',
    });

    choices.push({
      name: `${chalk.dim('🌐 Tarayıcıda OpenRouter API anahtarı al (openrouter.ai/keys)')}`,
      value: 'open_browser',
    });

    console.log('');
    const defaultVal =
      currentKey && currentKey.trim()
        ? 'keep'
        : hasLikelyKeyInClipboard
          ? 'use_clipboard'
          : 'read_clipboard';

    const choice = await select({
      message: `${stepPrefix}OpenRouter API Anahtarı:`,
      choices,
      default: defaultVal,
    });

    if (choice === 'keep' && currentKey) {
      return currentKey.trim();
    }

    if (choice === 'use_clipboard') {
      const clip = getClipboardText().trim();
      if (clip) {
        console.log(chalk.green(`  ✓ Panodan API anahtarı yapıştırıldı: ${chalk.bold(maskApiKey(clip))}\n`));
        return clip;
      }
    }

    if (choice === 'read_clipboard') {
      const clip = getClipboardText().trim();
      if (clip && isApiKeyLike(clip)) {
        console.log(chalk.green(`  ✓ Panodan API anahtarı yapıştırıldı: ${chalk.bold(maskApiKey(clip))}\n`));
        return clip;
      } else if (clip) {
        console.log(chalk.yellow(`\n  ⚠️  Panoda geçerli bir API anahtarı bulunamadı.`));
        console.log(chalk.dim(`  Pano içeriği: "${clip.slice(0, 30)}${clip.length > 30 ? '...' : ''}"`));
        console.log(chalk.cyan(`  Lütfen OpenRouter API anahtarınızı (sk-or-v1-...) kopyalayın ve tekrar 'Panodan Yapıştır'ı seçin.\n`));
        continue;
      } else {
        console.log(chalk.yellow(`\n  ⚠️  Panonuz şu an boş görünüyor.`));
        console.log(chalk.cyan(`  Lütfen OpenRouter API anahtarınızı (sk-or-v1-...) kopyalayıp tekrar deneyin.\n`));
        continue;
      }
    }

    if (choice === 'open_browser') {
      console.log(chalk.dim('  🌐 Tarayıcıda OpenRouter API Keys sayfası açılıyor...'));
      try {
        await open('https://openrouter.ai/keys');
      } catch {}
      console.log(chalk.cyan('  Anahtarınızı oluşturup kopyaladıktan (Ctrl+C) sonra "Panodan Yapıştır" seçeneğini seçin.\n'));
      continue;
    }

    if (choice === 'manual') {
      console.log(chalk.dim('\n  💡 İpucu: Terminale yapıştırmak için mouse ile Sağ Tık (Right-Click) yapabilir, Shift+Insert tuşlayabilir veya "paste" yazabilirsiniz.\n'));

      const entered = await input({
        message: 'OpenRouter API Key (sk-or-v1-...):',
        default: currentKey || undefined,
        validate: (v) => {
          const trimmed = (v || '').trim();
          if (!trimmed && !currentKey) {
            return 'API anahtarı boş bırakılamaz! Lütfen geçerli bir OpenRouter API Key girin.';
          }
          return true;
        },
      });

      let clean = entered.trim();

      // If user typed 'paste' or 'yapistir' or pressed Ctrl+V (which sends \x16 in terminal raw mode)
      if (clean.toLowerCase() === 'paste' || clean.toLowerCase() === 'yapistir' || clean.includes('\x16')) {
        const clip = getClipboardText().trim();
        if (clip) {
          clean = clip;
          console.log(chalk.green(`  ✓ Panodan API anahtarı yapıştırıldı: ${chalk.bold(maskApiKey(clean))}\n`));
          return clean;
        } else {
          console.log(chalk.yellow('  ⚠️ Panoda metin bulunamadı. Lütfen tekrar deneyin.\n'));
          continue;
        }
      }

      if (!clean && currentKey) {
        return currentKey.trim();
      }

      if (clean) {
        console.log(chalk.green(`  ✓ API anahtarı kaydedildi: ${chalk.bold(maskApiKey(clean))}\n`));
        return clean;
      }
    }
  }
}
