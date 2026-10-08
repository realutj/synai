import puppeteer, { Browser, Page } from 'puppeteer-core';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ToolDefinition } from '../types/index.js';
import { searchWeb } from './web_search_tool.js';

export interface BrowserToolResult {
  output: string;
  isError?: boolean;
  actionType: 'info' | 'search';
  url?: string;
  title?: string;
  screenshotPath?: string;
}

export interface BrowserActionParams {
  action:
    | 'navigate'
    | 'click'
    | 'type'
    | 'fill_form'
    | 'select_option'
    | 'press_key'
    | 'inspect'
    | 'screenshot'
    | 'scroll'
    | 'evaluate'
    | 'read_url'
    | 'search'
    | 'tabs'
    | 'new_tab'
    | 'select_tab'
    | 'close';
  url?: string;
  selector?: string;
  text?: string;
  value?: string;
  fields?: Record<string, string>;
  submit?: string;
  key?: string;
  direction?: 'up' | 'down';
  amount?: number;
  script?: string;
  query?: string;
  headless?: boolean;
  maxLength?: number;
  tabIndex?: number;
}

/**
 * Finds installed Chrome or Edge executable across Windows, macOS, and Linux.
 */
export function findSystemBrowser(): string | null {
  const platform = process.platform;

  if (platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else {
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/microsoft-edge',
      '/opt/google/chrome/chrome',
      '/snap/bin/chromium',
      '/usr/lib/chromium/chromium',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }

  const locator = platform === 'win32' ? 'where.exe' : 'which';
  const names = platform === 'win32'
    ? ['chrome.exe', 'msedge.exe']
    : platform === 'darwin'
      ? ['google-chrome', 'chrome', 'microsoft-edge', 'brave-browser']
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (const name of names) {
    const result = spawnSync(locator, [name], { encoding: 'utf8', windowsHide: true });
    const executable = result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : undefined;
    if (executable && fs.existsSync(executable)) return executable;
  }

  return null;
}

/**
 * Checks if Chrome Remote Debugging is active on specified port (default: 9222).
 */
export async function checkRemoteDebugging(port: number = 9222): Promise<{
  available: boolean;
  version?: string;
  browser?: string;
  tabs?: Array<{ id: string; title: string; url: string }>;
}> {
  try {
    const vRes = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!vRes.ok) return { available: false };
    const vData = (await vRes.json()) as any;

    let tabs: Array<{ id: string; title: string; url: string }> = [];
    try {
      const tRes = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(1500),
      });
      if (tRes.ok) {
        const tData = (await tRes.json()) as any[];
        tabs = tData
          .filter((t) => t.type === 'page')
          .map((t) => ({ id: t.id, title: t.title || 'Untitled', url: t.url || '' }));
      }
    } catch {}

    return {
      available: true,
      version: vData['Protocol-Version'],
      browser: vData.Browser,
      tabs,
    };
  } catch {
    return { available: false };
  }
}

/**
 * Launches Chrome automatically with remote debugging enabled.
 */
export async function launchRemoteDebuggingChrome(
  port: number = 9222
): Promise<{ success: boolean; message: string }> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { success: false, message: 'Chrome remote debugging port must be an integer from 1 to 65535.' };
  }
  const existing = await checkRemoteDebugging(port);
  if (existing.available) {
    return { success: true, message: `Chrome is already available on Remote Debugging port ${port}.` };
  }

  const exe = findSystemBrowser();
  if (!exe) return { success: false, message: 'Google Chrome or Microsoft Edge not found.' };

  const { spawn } = await import('node:child_process');
  const uDir = path.join(os.tmpdir(), 'synai-chrome-debug-profile');
  if (!fs.existsSync(uDir)) fs.mkdirSync(uDir, { recursive: true });

  const proc = spawn(
    exe,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${uDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' }
  );
  let launchError: Error | undefined;
  proc.once('error', (error) => { launchError = error; });
  proc.unref();

  // Wait up to 4 seconds for debugging port to become active
  for (let i = 0; i < 8; i++) {
    if (launchError) return { success: false, message: `Could not launch Chrome: ${launchError.message}` };
    await new Promise((r) => setTimeout(r, 500));
    const status = await checkRemoteDebugging(port);
    if (status.available) {
      return {
        success: true,
        message: `Chrome successfully launched with Remote Debugging on port ${port}!`,
      };
    }
  }

  return { success: false, message: `Chrome started, waiting for debugging port ${port}...` };
}

/**
 * Singleton BrowserManager for interactive web automation (form filling, clicking, browsing).
 */
export class BrowserManager {
  private static instance: BrowserManager | null = null;
  private browser: Browser | null = null;
  private activePage: Page | null = null;
  private executablePath: string | null = null;
  private isHeadless: boolean = false;
  private cdpPort: number = 9222;
  private ownsBrowser: boolean = false;

  private constructor() {
    this.executablePath = findSystemBrowser();
  }

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public setRemoteDebuggingPort(port: number): void {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Chrome remote debugging port must be an integer from 1 to 65535.');
    }
    this.cdpPort = port;
  }

  /** Drop this process's CDP connection while leaving the Chrome window open. */
  public async release(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.disconnect();
      } catch {}
    }
    this.browser = null;
    this.activePage = null;
    this.ownsBrowser = false;
  }

  private async isSynAIBrowser(): Promise<boolean> {
    if (!this.browser?.connected) return false;
    let client: Awaited<ReturnType<ReturnType<Browser['target']>['createCDPSession']>> | undefined;
    try {
      client = await this.browser.target().createCDPSession();
      const { arguments: browserArgs } = await client.send('Browser.getBrowserCommandLine');
      const expectedProfiles = new Set([
        path.join(os.tmpdir(), 'synai-interactive-browser-profile'),
        path.join(os.tmpdir(), 'synai-chrome-debug-profile'),
      ]);
      return browserArgs.some((arg: string, index: number) =>
        [...expectedProfiles].some((profile) =>
          arg === `--user-data-dir=${profile}` ||
          (arg === '--user-data-dir' && browserArgs[index + 1] === profile)
        )
      );
    } catch {
      return false;
    } finally {
      await client?.detach().catch(() => {});
    }
  }

  public async getStatus(): Promise<{
    isConnected: boolean;
    port: number;
    browserName: string;
    activeUrl: string;
    activeTitle: string;
    tabs: Array<{ id: string; title: string; url: string }>;
  }> {
    const cdp = await checkRemoteDebugging(this.cdpPort);
    let activeUrl = '';
    let activeTitle = '';

    if (this.activePage && !this.activePage.isClosed()) {
      try {
        activeUrl = this.activePage.url();
        activeTitle = await this.activePage.title();
      } catch {}
    }

    return {
      isConnected: (this.browser && this.browser.connected) || cdp.available,
      port: this.cdpPort,
      browserName: cdp.browser || 'Google Chrome',
      activeUrl,
      activeTitle,
      tabs: cdp.tabs || [],
    };
  }

  public async connectToRemote(
    port: number = 9222
  ): Promise<{ success: boolean; message: string; tabs: any[] }> {
    this.cdpPort = port;
    const status = await checkRemoteDebugging(port);
    if (!status.available) {
      return {
        success: false,
        message: `Remote debugging is not active on port ${port}. Please enable it in Chrome via chrome://inspect/#remote-debugging or launch Chrome with debugging enabled.`,
        tabs: [],
      };
    }

    if (this.browser) {
      try {
        if (this.ownsBrowser) await this.browser.close();
        else await this.browser.disconnect();
      } catch {}
    }

    this.browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${port}`,
      defaultViewport: null,
    });
    this.ownsBrowser = false;

    const pages = await this.browser.pages();
    this.activePage = pages.length > 0 ? pages[0] : await this.browser.newPage();
    this.activePage.setDefaultTimeout(15000);

    return {
      success: true,
      message: `Connected to Chrome (${status.browser}) via Remote Debugging port ${port}!`,
      tabs: status.tabs || [],
    };
  }

  private async getPage(headless: boolean = false): Promise<Page> {
    if (this.browser && this.browser.connected && this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }

    // Try connecting to existing Remote Debugging Chrome on port 9222 first!
    const cdp = await checkRemoteDebugging(this.cdpPort);
    if (cdp.available) {
      try {
        const connectRes = await this.connectToRemote(this.cdpPort);
        if (connectRes.success && this.activePage) {
          return this.activePage;
        }
      } catch {}
    }

    if (!this.executablePath) {
      throw new Error(
        'Could not find Google Chrome or Microsoft Edge installed on this system. Please install Chrome or Edge to use interactive browser automation.'
      );
    }

    const userDataDir = path.join(os.tmpdir(), 'synai-interactive-browser-profile');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    this.isHeadless = headless;

    this.browser = await puppeteer.launch({
      executablePath: this.executablePath,
      headless: this.isHeadless,
      defaultViewport: { width: 1280, height: 800 },
      userDataDir,
      args: [
        '--disable-dev-shm-usage',
        `--remote-debugging-port=${this.cdpPort}`,
        '--window-size=1280,800',
      ],
    });
    this.ownsBrowser = true;

    const pages = await this.browser.pages();
    this.activePage = pages.length > 0 ? pages[0] : await this.browser.newPage();
    this.activePage.setDefaultTimeout(15000);
    this.activePage.setDefaultNavigationTimeout(20000);

    return this.activePage;
  }

  /**
   * Inspects the active page and returns all interactive form elements and buttons.
   */
  public async getInteractiveElements(page: Page): Promise<string> {
    try {
      const elements = await page.evaluate(() => {
        const results: string[] = [];

        // Forms and Inputs
        const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
        inputs.forEach((el) => {
          const input = el as HTMLInputElement;
          if (input.type === 'hidden') return;
          const id = input.id ? `#${input.id}` : '';
          const name = input.name ? `name="${input.name}"` : '';
          const type = input.type ? `type="${input.type}"` : '';
          const placeholder = input.placeholder ? `placeholder="${input.placeholder}"` : '';
          const label = input.labels?.[0]?.innerText?.trim() || '';
          const sensitiveMetadata = [
            input.id,
            input.name,
            input.autocomplete,
            input.placeholder,
            input.getAttribute('aria-label'),
            label,
          ].join(' ').toLowerCase();
          const sensitiveFieldPattern =
            /password|passwd|passcode|secret|token|api[_ -]?key|access[_ -]?key|private[_ -]?key|credential|authorization|one[_ -]?time|\botp\b|credit[_ -]?card|debit[_ -]?card|card[_ -]?(number|security|code)|social[_ -]?security|national[_ -]?(identity|id)|tax[_ -]?id|bank[_ -]?(account|routing)|routing[_ -]?number|\b(cvv|cvc|ssn)\b/;
          const sensitiveValue =
            input.type.toLowerCase() === 'password' ||
            sensitiveFieldPattern.test(sensitiveMetadata);
          const value = input.value
            ? `value="${sensitiveValue ? '[redacted]' : input.value.slice(0, 20)}"`
            : '';
          const labelStr = label ? `label="${label}"` : '';
          results.push(
            `- [Input] ${input.tagName.toLowerCase()}${id} ${name} ${type} ${placeholder} ${labelStr} ${value}`
              .replace(/\s+/g, ' ')
              .trim()
          );
        });

        // Clickable Buttons
        const buttons = Array.from(
          document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"], a.btn')
        );
        buttons.slice(0, 20).forEach((b) => {
          const btn = b as HTMLElement;
          const text =
            btn.innerText?.trim() || btn.getAttribute('value') || btn.getAttribute('aria-label') || '';
          const id = btn.id ? `#${btn.id}` : '';
          const classes =
            btn.className && typeof btn.className === 'string'
              ? `.${btn.className.trim().split(/\s+/).slice(0, 2).join('.')}`
              : '';
          if (text) {
            results.push(`- [Button] ${id || classes || 'button'} text="${text}"`.replace(/\s+/g, ' ').trim());
          }
        });

        // Prominent navigation links
        const links = Array.from(document.querySelectorAll('nav a, header a, main a, article a'));
        links.slice(0, 15).forEach((l) => {
          const a = l as HTMLAnchorElement;
          const text = a.innerText?.trim() || '';
          const href = a.getAttribute('href') || '';
          if (text && href && !href.startsWith('javascript:') && !href.startsWith('#')) {
            results.push(`- [Link] "${text}" -> ${href}`.replace(/\s+/g, ' ').trim());
          }
        });

        return results;
      });

      if (elements.length === 0) {
        return 'No distinct form fields or buttons detected on this page.';
      }

      return elements.join('\n');
    } catch {
      return 'Could not extract interactive elements.';
    }
  }

  public async execute(
    workspaceRoot: string,
    params: BrowserActionParams
  ): Promise<BrowserToolResult> {
    const action = params.action;

    try {
      // 1. Lightweight search
      if (action === 'search') {
        const q = params.query || params.url || '';
        if (!q.trim()) return { output: 'Error: search query is required.', isError: true, actionType: 'search' };
        const res = await searchWeb(q);
        return { output: res.output, isError: res.isError, actionType: 'search' };
      }

      // 2. Lightweight URL reading
      if (action === 'read_url') {
        const targetUrl = params.url || params.query || '';
        return await readUrlContent(targetUrl, params.maxLength || 8000);
      }

      // 3. Close browser
      if (action === 'close') {
        if (this.browser) {
          try {
            if (this.ownsBrowser || await this.isSynAIBrowser()) await this.browser.close();
            else await this.browser.disconnect();
          } catch {}
          this.browser = null;
          this.activePage = null;
          this.ownsBrowser = false;
        }
        return { output: 'SynAI browser session closed. Existing personal Chrome windows remain open.', actionType: 'info' };
      }

      // --- Interactive Actions requiring Puppeteer ---
      const page = await this.getPage(params.headless ?? false);

      if (action === 'tabs') {
        const pages = await this.browser!.pages();
        const tabs = await Promise.all(pages.map(async (tab, index) => ({
          index,
          title: await tab.title(),
          url: tab.url(),
          active: tab === this.activePage,
        })));
        return { output: JSON.stringify(tabs, null, 2), actionType: 'info' };
      }

      if (action === 'new_tab') {
        const tab = await this.browser!.newPage();
        tab.setDefaultTimeout(15000);
        this.activePage = tab;
        if (params.url) {
          let targetUrl = params.url.trim();
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) targetUrl = `https://${targetUrl}`;
          await tab.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        }
        await tab.bringToFront();
        return { output: `Opened tab ${await tab.title()} (${tab.url()})`, actionType: 'info', url: tab.url(), title: await tab.title() };
      }

      if (action === 'select_tab') {
        const pages = await this.browser!.pages();
        if (params.tabIndex === undefined || !pages[params.tabIndex]) {
          return { output: `Error: a valid tab index is required; Chrome has ${pages.length} tab(s).`, isError: true, actionType: 'info' };
        }
        this.activePage = pages[params.tabIndex];
        await this.activePage.bringToFront();
        return { output: `Selected tab ${params.tabIndex}: ${await this.activePage.title()} (${this.activePage.url()})`, actionType: 'info', url: this.activePage.url(), title: await this.activePage.title() };
      }

      if (params.url && ['screenshot', 'inspect', 'evaluate'].includes(action)) {
        let targetUrl = params.url.trim();
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = `https://${targetUrl}`;
        }
        if (page.url() !== targetUrl) {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.bringToFront();
        }
      }

      switch (action) {
        case 'navigate': {
          if (!params.url)
            return { output: 'Error: URL is required for navigate.', isError: true, actionType: 'info' };
          let targetUrl = params.url.trim();
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = `https://${targetUrl}`;
          }

          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          const title = await page.title();
          const currentUrl = page.url();
          const interactiveElements = await this.getInteractiveElements(page);

          return {
            output: `✓ Navigated to: ${currentUrl}\nPage Title: ${title}\n\nInteractive Form Fields & Buttons:\n${interactiveElements}\n\n(You can now use "click" to press buttons or "type"/"fill_form" to fill inputs)`,
            actionType: 'info',
            url: currentUrl,
            title,
          };
        }

        case 'click': {
          if (!params.selector && !params.text) {
            return {
              output: 'Error: selector or text is required for click action.',
              isError: true,
              actionType: 'info',
            };
          }

          let clicked = false;
          let targetDesc = params.selector || params.text;

          if (params.selector) {
            await page.waitForSelector(params.selector, { timeout: 8000 });
            await page.click(params.selector);
            clicked = true;
          } else if (params.text) {
            clicked = await page.evaluate((targetText) => {
              const xpath = `//*[self::button or self::a or self::input[@type='submit' or @type='button'] or self::span or self::div][contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${targetText.toLowerCase()}')]`;
              const el = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              ).singleNodeValue as HTMLElement;
              if (el) {
                el.click();
                return true;
              }
              return false;
            }, params.text);
          }

          if (!clicked) {
            const available = await this.getInteractiveElements(page);
            return {
              output: `Could not find clickable element matching "${targetDesc}".\n\nAvailable elements on page:\n${available}`,
              isError: true,
              actionType: 'info',
            };
          }

          await new Promise((r) => setTimeout(r, 1000));
          const currentUrl = page.url();
          const title = await page.title();
          const updatedElements = await this.getInteractiveElements(page);

          return {
            output: `✓ Clicked: "${targetDesc}"\nCurrent Page: ${title} (${currentUrl})\n\nUpdated Elements:\n${updatedElements}`,
            actionType: 'info',
            url: currentUrl,
            title,
          };
        }

        case 'type': {
          const sel = params.selector || '';
          const txt = params.text ?? params.value ?? '';
          if (!sel) {
            return {
              output: 'Error: selector (or field name/id) is required for type action.',
              isError: true,
              actionType: 'info',
            };
          }

          const found = await page.evaluate((targetSel) => {
            const el =
              document.querySelector(targetSel) ||
              document.querySelector(`#${targetSel}`) ||
              document.querySelector(`input[name="${targetSel}"]`) ||
              document.querySelector(`textarea[name="${targetSel}"]`) ||
              document.querySelector(`input[placeholder*="${targetSel}" i]`);
            if (el) {
              (el as HTMLInputElement).focus();
              return (el as HTMLInputElement).id ? `#${(el as HTMLInputElement).id}` : targetSel;
            }
            return null;
          }, sel);

          const targetSelector = found || sel;
          await page.waitForSelector(targetSelector, { timeout: 8000 });
          await page.click(targetSelector, { count: 3 });
          await page.keyboard.press('Backspace');
          await page.type(targetSelector, txt, { delay: 30 });

          return {
            output: `✓ Typed "${txt}" into ${targetSelector}`,
            actionType: 'info',
          };
        }

        case 'fill_form': {
          if (!params.fields || typeof params.fields !== 'object') {
            return {
              output:
                'Error: fields object (e.g. { "name": "Ali", "email": "ali@test.com" }) is required for fill_form.',
              isError: true,
              actionType: 'info',
            };
          }

          const filledList: string[] = [];

          for (const [key, val] of Object.entries(params.fields)) {
            const found = await page.evaluate((fieldKey) => {
              const el =
                document.querySelector(fieldKey) ||
                document.querySelector(`#${fieldKey}`) ||
                document.querySelector(`input[name="${fieldKey}"]`) ||
                document.querySelector(`textarea[name="${fieldKey}"]`) ||
                document.querySelector(`input[placeholder*="${fieldKey}" i]`);
              if (el) {
                (el as HTMLInputElement).focus();
                return (el as HTMLInputElement).id ? `#${(el as HTMLInputElement).id}` : fieldKey;
              }
              return null;
            }, key);

            const targetSel = found || key;
            try {
              await page.click(targetSel, { count: 3 });
              await page.keyboard.press('Backspace');
              await page.type(targetSel, String(val), { delay: 20 });
              filledList.push(`${key}: "${val}"`);
            } catch {
              filledList.push(`[Failed to find/fill]: ${key}`);
            }
          }

          let submitMsg = '';
          if (params.submit) {
            const submitBtn = params.submit;
            const submitted = await page.evaluate((btnTextOrSel) => {
              const direct = document.querySelector(btnTextOrSel) as HTMLElement;
              if (direct) {
                direct.click();
                return true;
              }
              const xpath = `//*[self::button or self::input[@type='submit']][contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${btnTextOrSel.toLowerCase()}')]`;
              const el = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              ).singleNodeValue as HTMLElement;
              if (el) {
                el.click();
                return true;
              }
              return false;
            }, submitBtn);

            if (submitted) {
              await new Promise((r) => setTimeout(r, 1500));
              submitMsg = `\n✓ Clicked submit button: "${submitBtn}"`;
            } else {
              submitMsg = `\n⚠ Submit button "${submitBtn}" not found.`;
            }
          }

          const currentTitle = await page.title();
          const currentUrl = page.url();

          return {
            output: `✓ Form Filled:\n${filledList.map((f) => `  * ${f}`).join('\n')}${submitMsg}\n\nPage Title: ${currentTitle} (${currentUrl})`,
            actionType: 'info',
            url: currentUrl,
            title: currentTitle,
          };
        }

        case 'select_option': {
          if (!params.selector || !params.value) {
            return {
              output: 'Error: selector and value are required for select_option.',
              isError: true,
              actionType: 'info',
            };
          }
          await page.waitForSelector(params.selector, { timeout: 8000 });
          await page.select(params.selector, params.value);
          return {
            output: `✓ Selected value "${params.value}" in dropdown ${params.selector}`,
            actionType: 'info',
          };
        }

        case 'press_key': {
          const key = params.key || 'Enter';
          await page.keyboard.press(key as any);
          await new Promise((r) => setTimeout(r, 800));
          return {
            output: `✓ Pressed key: ${key} on page ${await page.title()}`,
            actionType: 'info',
          };
        }

        case 'inspect': {
          const title = await page.title();
          const currentUrl = page.url();
          const elements = await this.getInteractiveElements(page);
          return {
            output: `Page: ${title} (${currentUrl})\n\nInteractive Form Elements & Clickables:\n${elements}`,
            actionType: 'info',
            url: currentUrl,
            title,
          };
        }

        case 'screenshot': {
          const screenshotDir = path.join(workspaceRoot, '.synai', 'screenshots');
          if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
          }
          const filename = `screenshot_${Date.now()}.png`;
          const filePath = path.join(screenshotDir, filename);
          await page.screenshot({ path: filePath, fullPage: false });
          const relPath = path.relative(workspaceRoot, filePath);

          return {
            output: `✓ Screenshot captured: ${relPath}`,
            screenshotPath: relPath,
            actionType: 'info',
          };
        }

        case 'scroll': {
          const dir = params.direction || 'down';
          const px = params.amount || 500;
          await page.evaluate(
            (d, p) => {
              window.scrollBy(0, d === 'down' ? p : -p);
            },
            dir,
            px
          );
          return { output: `✓ Scrolled ${dir} by ${px}px`, actionType: 'info' };
        }

        case 'evaluate': {
          if (!params.script) {
            return { output: 'Error: script is required for evaluate.', isError: true, actionType: 'info' };
          }
          const result = await page.evaluate(params.script);
          return {
            output: `Script Result:\n${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`,
            actionType: 'info',
          };
        }

        default:
          return {
            output: `Unknown action: "${action}". Available actions: navigate, click, type, fill_form, select_option, press_key, inspect, screenshot, scroll, read_url, search, close.`,
            isError: true,
            actionType: 'info',
          };
      }
    } catch (err: any) {
      return {
        output: `Browser Error (${action}): ${err.message}`,
        isError: true,
        actionType: 'info',
      };
    }
  }
}

/**
 * Fast HTTP HTML to Markdown reader (fallback / lightweight).
 */
export async function readUrlContent(
  url: string,
  maxLength: number = 8000
): Promise<BrowserToolResult> {
  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,*/*;q=0.8',
        'Accept-Language': 'tr,en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return {
        output: `Failed to fetch URL ${cleanUrl}: HTTP ${res.status} ${res.statusText}`,
        isError: true,
        actionType: 'info',
        url: cleanUrl,
      };
    }

    const rawText = await res.text();
    const titleMatch = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    let cleaned = rawText
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    const truncated = cleaned.slice(0, maxLength);
    return {
      output: `# ${title || 'Page Content'}\nURL: ${cleanUrl}\n\n${truncated}`,
      actionType: 'info',
      url: cleanUrl,
      title,
    };
  } catch (err: any) {
    return { output: `Error fetching ${url}: ${err.message}`, isError: true, actionType: 'info', url };
  }
}

export async function executeBrowser(
  params: BrowserActionParams,
  workspaceRoot: string = process.cwd()
): Promise<BrowserToolResult> {
  return await BrowserManager.getInstance().execute(workspaceRoot, params);
}

export async function executeBrowserTool(
  toolName: string,
  args: Record<string, any>,
  workspaceRoot: string = process.cwd()
): Promise<BrowserToolResult> {
  if (toolName === 'read_url_content') {
    return await readUrlContent(args.url || args.targetUrl, args.maxLength);
  }
  if (toolName === 'read_browser_page') {
    const action = args.action || 'read';
    if (action === 'screenshot') {
      return await BrowserManager.getInstance().execute(workspaceRoot, {
        action: 'screenshot',
        url: args.url,
        headless: args.headless ?? true,
      });
    } else if (action === 'inspect') {
      return await BrowserManager.getInstance().execute(workspaceRoot, {
        action: 'inspect',
        url: args.url,
        headless: args.headless ?? true,
      });
    } else if (action === 'eval' || action === 'evaluate') {
      return await BrowserManager.getInstance().execute(workspaceRoot, {
        action: 'evaluate',
        url: args.url,
        script: args.script,
        headless: args.headless ?? true,
      });
    } else {
      return await BrowserManager.getInstance().execute(workspaceRoot, {
        action: 'read_url',
        url: args.url,
        headless: args.headless ?? true,
      });
    }
  }
  const action =
    args.action || (toolName.startsWith('browser_') ? toolName.replace('browser_', '') : 'navigate');
  return await BrowserManager.getInstance().execute(workspaceRoot, { ...args, action });
}

export const browserToolDefinition: ToolDefinition = {
  name: 'browser',
  description:
    'Interactive Autonomous Web Browser. Can navigate pages, fill forms, type into inputs, click buttons/links, select dropdowns, press keys, take screenshots, inspect form fields, and search the web.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'navigate',
          'click',
          'type',
          'fill_form',
          'select_option',
          'press_key',
          'inspect',
          'screenshot',
          'scroll',
          'evaluate',
          'read_url',
          'search',
          'close',
        ],
        description:
          'The browser action: "navigate" (go to url), "click" (click button/link by selector or text), "type" (type into input), "fill_form" (fill multiple fields), "inspect" (list all form inputs and buttons), "screenshot" (capture image), "press_key" (Enter, Tab, etc.), "evaluate" (evaluate JS code), "search" (web search).',
      },
      url: { type: 'string', description: 'Web page URL to navigate to or read.' },
      selector: { type: 'string', description: 'CSS selector for element to click, type into, or select.' },
      text: {
        type: 'string',
        description: 'Text to type, or visible button/link text to click (e.g. "Login", "Submit", "Sign In").',
      },
      fields: {
        type: 'object',
        description: 'Key-value map of form fields for "fill_form" (e.g. { "username": "admin", "email": "test@test.com" }).',
      },
      submit: { type: 'string', description: 'Optional submit button text or selector to click after fill_form.' },
      key: { type: 'string', description: 'Key name to press (e.g. "Enter", "Tab", "Escape").' },
      script: { type: 'string', description: 'JavaScript code to evaluate in page context.' },
      query: { type: 'string', description: 'Search query when action is "search".' },
      headless: { type: 'boolean', description: 'Whether to run headless (default: false, so user can watch form filling).' },
    },
    required: ['action'],
  },
};

export const readBrowserPageToolDefinition: ToolDefinition = {
  name: 'read_browser_page',
  description:
    'Fetch and interact with a live web page using headless browser automation (Antigravity-compatible). Renders client-side dynamic JavaScript, extracts structured text/markdown, captures screenshots, and inspects interactive buttons and forms.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The webpage URL to visit and interact with.' },
      action: {
        type: 'string',
        enum: ['read', 'screenshot', 'inspect', 'eval'],
        description:
          "Action to perform: 'read' (default: render and extract clean markdown text), 'screenshot' (capture image), 'inspect' (list interactive elements), 'eval' (evaluate JavaScript).",
      },
      script: {
        type: 'string',
        description: 'JavaScript code to execute in the browser page when action is "eval".',
      },
      screenshotPath: {
        type: 'string',
        description: 'File path to save the screenshot image to when action is "screenshot".',
      },
      headless: {
        type: 'boolean',
        description: 'Run browser in headless background mode (default: true).',
      },
    },
    required: ['url'],
  },
};

export const browserTools: ToolDefinition[] = [browserToolDefinition, readBrowserPageToolDefinition];
