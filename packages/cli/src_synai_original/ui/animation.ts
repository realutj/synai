import chalk from 'chalk';
import ora, { Ora } from 'ora';

function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[\d+;?\d*m/g, '').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

function centerText(text: string, width: number = getTerminalWidth()): string {
  const visualLength = stripAnsi(text).length;
  if (visualLength >= width) return text;
  const pad = Math.max(0, Math.floor((width - visualLength) / 2));
  return ' '.repeat(pad) + text;
}

export class AnimatedSpinner {
  private spinner: Ora | null = null;
  private startTime: number = 0;
  private timerInterval: NodeJS.Timeout | null = null;
  private currentBaseText: string = 'Thinking...';
  private frames: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex: number = 0;

  public start(initialText: string = 'Thinking...'): void {
    this.stop();
    this.currentBaseText = initialText;
    this.startTime = Date.now();
    this.frameIndex = 0;

    this.spinner = ora({
      text: this.formatSpinnerText(),
      spinner: {
        interval: 80,
        frames: this.frames,
      },
      color: 'white',
      hideCursor: true,
    }).start();

    this.timerInterval = setInterval(() => {
      if (this.spinner && this.spinner.isSpinning) {
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        this.spinner.text = this.formatSpinnerText();
      }
    }, 100);
  }

  public updateText(newText: string): void {
    this.currentBaseText = newText;
    if (this.spinner && this.spinner.isSpinning) {
      this.spinner.text = this.formatSpinnerText();
    }
  }

  private formatSpinnerText(): string {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const width = getTerminalWidth();
    const maxTextLen = Math.max(15, width - 20);
    const displayText = this.currentBaseText.length > maxTextLen
      ? this.currentBaseText.slice(0, maxTextLen - 3) + '...'
      : this.currentBaseText;
    const content = `${chalk.white(displayText)} ${chalk.dim(`(${elapsed}s)`)}`;
    const visualLength = stripAnsi(content).length + 3;
    const pad = Math.max(0, Math.floor((width - visualLength) / 2));
    if (this.spinner) {
      this.spinner.prefixText = ' '.repeat(pad);
    }
    return ` ${content}`;
  }

  public stop(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  public succeed(text: string): void {
    const width = getTerminalWidth();
    this.stop();
    console.log(centerText(chalk.white(`  ✓ ${text}`), width));
  }

  public fail(text: string): void {
    const width = getTerminalWidth();
    this.stop();
    console.log(centerText(chalk.white(`  ✗ ${text}`), width));
  }

  public warn(text: string): void {
    const width = getTerminalWidth();
    this.stop();
    console.log(centerText(chalk.gray(`  ⚠ ${text}`), width));
  }

  public info(text: string): void {
    const width = getTerminalWidth();
    this.stop();
    console.log(centerText(chalk.white(`  ℹ ${text}`), width));
  }

  public isSpinning(): boolean {
    return this.spinner !== null && this.spinner.isSpinning;
  }
}

export function renderProgressBar(percent: number, width: number = 14): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  const barFilled = chalk.white('█'.repeat(filled));
  const barEmpty = chalk.dim('░'.repeat(empty));

  // Color-code the percentage
  let percentColor = chalk.gray;
  if (clamped >= 75) percentColor = chalk.white;
  else if (clamped >= 50) percentColor = chalk.white;
  else if (clamped >= 25) percentColor = chalk.gray;
  else percentColor = chalk.white;

  return `[${barFilled}${barEmpty}] ${percentColor(`${clamped}%`)}`;
}

export async function playIntroAnimation(): Promise<void> {
  // Fast, elegant intro - just clear and show cursor
  const width = getTerminalWidth();
  
  // Quick fade-in effect
  const frames = [
    chalk.dim('  Initializing...'),
    chalk.white('  Initializing...'),
    chalk.bold.white('  Ready! ✓'),
  ];
  
  for (const frame of frames) {
    process.stdout.write('\r' + centerText(frame, width));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  process.stdout.write('\r' + ' '.repeat(width) + '\r');
}

export function drawBox(title: string, content: string[], width: number = 50): string[] {
  const lines: string[] = [];
  const top = chalk.white('╔' + '═'.repeat(width - 2) + '╗');
  const bot = chalk.white('╚' + '═'.repeat(width - 2) + '╝');
  
  lines.push(top);
  
  // Title
  if (title) {
    const titlePad = Math.floor((width - 2 - stripAnsi(title).length) / 2);
    const titleLine = chalk.white('║') + ' '.repeat(titlePad) + title + ' '.repeat(width - 2 - titlePad - stripAnsi(title).length) + chalk.white('║');
    lines.push(titleLine);
    lines.push(chalk.white('╠' + '═'.repeat(width - 2) + '╣'));
  }
  
  // Content
  for (const line of content) {
    const contentLen = stripAnsi(line).length;
    const padding = width - 2 - contentLen;
    lines.push(chalk.white('║') + line + ' '.repeat(Math.max(0, padding)) + chalk.white('║'));
  }
  
  lines.push(bot);
  return lines;
}
