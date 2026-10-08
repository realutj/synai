import notifier from 'node-notifier';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Play system sound using Windows API
 */
function playWindowsSound(_soundType: 'notification' | 'success' | 'question' = 'notification') {
  if (!currentPreferences.soundEnabled || !currentPreferences.enabled) return;
  if (process.platform !== 'win32') return;

  
  const command = `powershell -c "[console]::beep(800, 200); [console]::beep(1000, 150)"`;
  
  try {
    exec(command, (error) => {
      if (error) {
        // Silent fallback
      }
    });
  } catch {}
}

/**
 * Play success sound - more melodic
 */


/**
 * Show desktop notification for approval request
 */
export function showApprovalNotification(toolName: string, _args: any): void {
  if (!shouldShowNotification('showApprovalRequests')) return;

  const title = 'SynAI - Approval Required';
  const _message = `"${toolName}" requires confirmation.\n\nReturn to terminal to approve or reject.`;

  notifier.notify({
    title,
    _message,
    icon: getIconPath(),
    wait: false,
    timeout: 10,
    appID: 'SynAI',
  } as any);

  // Play notification sound if enabled
  playWindowsSound('question');
}

/**
 * Show desktop notification when task is completed
 */
export function showCompletionNotification(_message: string = 'Task completed!'): void {
  // Completion notification & beep sound disabled per user request
  return;
}

/**
 * Show error notification
 */
export function showErrorNotification(error: string): void {
  const title = '[!] SynAI - Error';
  const _message = error.length > 100 ? error.substring(0, 100) + '...' : error;

  notifier.notify({
    title,
    _message,
    icon: getIconPath(),
    wait: false,
    timeout: 8,
    appID: 'SynAI',
  } as any);
}

/**
 * Show info notification
 */
export function showInfoNotification(title: string, _message: string): void {
  notifier.notify({
    title: `[i] SynAI - ${title}`,
    _message,
    icon: getIconPath(),
    wait: false,
    timeout: 5,
    appID: 'SynAI',
  } as any);
}

/**
 * Get icon path for notifications
 */
function getIconPath(): string | undefined {
  try {
    // Try to find logo in public folder
    const possiblePaths = [
      path.join(process.cwd(), 'packages', 'web', 'public', 'logo.svg'),
      path.join(process.cwd(), 'logo.png'),
      path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    ];

    for (const iconPath of possiblePaths) {
      try {
        if (require('fs').existsSync(iconPath)) {
          return iconPath;
        }
      } catch {}
    }
  } catch {}
  
  return undefined;
}

/**
 * Test notification system
 */
export function testNotifications(): void {
  console.log('Testing notification system...\n');
  
  console.log('1. Approval notification...');
  showApprovalNotification('write_file', { filePath: 'test.ts' });
  
  setTimeout(() => {
    console.log('2. Success notification...');
    showCompletionNotification('Test task completed successfully!');
  }, 2000);
  
  setTimeout(() => {
    console.log('3. Info notification...');
    showInfoNotification('Model Changed', 'New model: GPT-4');
  }, 4000);
  
  setTimeout(() => {
    console.log('\nTest completed!');
  }, 6000);
}

// Notification preferences
export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  showApprovalRequests: boolean;
  showCompletion: boolean;
  showErrors: boolean;
}

const defaultPreferences: NotificationPreferences = {
  enabled: true,
  soundEnabled: false,
  showApprovalRequests: true,
  showCompletion: false,
  showErrors: true,
};

let currentPreferences: NotificationPreferences = { ...defaultPreferences };

export function setNotificationPreferences(prefs: Partial<NotificationPreferences>): void {
  currentPreferences = { ...currentPreferences, ...prefs };
}

export function getNotificationPreferences(): NotificationPreferences {
  return { ...currentPreferences };
}

export function shouldShowNotification(type: keyof NotificationPreferences): boolean {
  if (!currentPreferences.enabled) return false;
  return currentPreferences[type] === true;
}
