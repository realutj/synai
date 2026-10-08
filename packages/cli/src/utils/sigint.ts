/**
 * Double Ctrl+C (SIGINT) handler for SynAI CLI
 * Exits only when Ctrl+C is pressed twice within 1.5 seconds.
 */

import chalk from 'chalk';
import type readline from 'node:readline/promises';

const SIGINT_THRESHOLD_MS = 1500;

export function handleSigint(onFirstPress?: () => void, onExit?: () => void): boolean {
  const now = Date.now();
  const lastTime = (global as any).__synaiLastSigintTime || 0;

  if (now - lastTime <= SIGINT_THRESHOLD_MS) {
    (global as any).__synaiLastSigintTime = 0;
    if (onExit) {
      try {
        onExit();
      } catch {}
    }
    console.log('\n' + chalk.dim('[OK] Session saved. Goodbye!\n'));
    process.exit(0);
  } else {
    (global as any).__synaiLastSigintTime = now;
    if (onFirstPress) {
      onFirstPress();
    } else {
      console.log('\n' + chalk.dim('(Press Ctrl+C again to exit)'));
    }
    return false;
  }
}

export function bindSigintToReadline(
  rl: readline.Interface,
  promptPrefix: string = '> ',
  onFirstPressExtra?: () => void
): void {
  rl.on('SIGINT', () => {
    handleSigint(() => {
      try {
        (rl as any).line = '';
        (rl as any).cursor = 0;
      } catch {}
      if (onFirstPressExtra) {
        try {
          onFirstPressExtra();
        } catch {}
      }
      process.stdout.write('\n' + chalk.dim('(Press Ctrl+C again to exit)\n' + promptPrefix));
    });
  });
}

export function resetSigintTime(): void {
  (global as any).__synaiLastSigintTime = 0;
}
