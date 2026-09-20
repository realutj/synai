import type { Browser, Page } from 'puppeteer-core';
import path from 'node:path';

export interface BrowserSession {
  browser: Browser;
  page: Page;
  sessionId: string;
  startTime: number;
}

export class BrowserController {
  private sessions: Map<string, BrowserSession> = new Map();
  private defaultSession: BrowserSession | null = null;

  /**
   * Launch a new Chrome browser instance
   */
  async launch(options: {
    headless?: boolean;
    width?: number;
    height?: number;
    userDataDir?: string;
  } = {}): Promise<BrowserSession> {
    const {
      headless = false,
      width = 1280,
      height = 720,
      userDataDir,
    } = options;

    let pptr: any;
    try {
      pptr = (await import('puppeteer')).default;
    } catch {
      try {
        pptr = (await import('puppeteer-core')).default;
      } catch {
        throw new Error('Puppeteer is not installed. To use browser automation, run: npm install -g puppeteer');
      }
    }

    const browser = await pptr.launch({
      headless,
      args: [
        `--window-size=${width},${height}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      ...(userDataDir ? { userDataDir } : {}),
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });

    const sessionId = `session_${Date.now()}`;
    const session: BrowserSession = {
      browser,
      page,
      sessionId,
      startTime: Date.now(),
    };

    this.sessions.set(sessionId, session);
    
    if (!this.defaultSession) {
      this.defaultSession = session;
    }

    return session;
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    return `Navigated to ${url}`;
  }

  /**
   * Click an element
   */
  async click(selector: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.page.waitForSelector(selector, { timeout: 10000 });
    await session.page.click(selector);
    return `Clicked element: ${selector}`;
  }

  /**
   * Type text into an input
   */
  async type(selector: string, text: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.page.waitForSelector(selector, { timeout: 10000 });
    await session.page.type(selector, text);
    return `Typed "${text}" into ${selector}`;
  }

  /**
   * Press a key
   */
  async pressKey(key: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.page.keyboard.press(key as any);
    return `Pressed key: ${key}`;
  }

  /**
   * Take a screenshot
   */
  async screenshot(filePath: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.page.screenshot({ path: filePath, fullPage: true });
    return `Screenshot saved to ${filePath}`;
  }

  /**
   * Extract text from the page
   */
  async extractText(selector?: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    
    if (selector) {
      await session.page.waitForSelector(selector, { timeout: 10000 });
      const text = await session.page.$eval(selector, el => el.textContent || '');
      return text;
    }
    
    const text = await session.page.evaluate(() => document.body.innerText);
    return text;
  }

  /**
   * Get HTML content
   */
  async getHtml(selector?: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    
    if (selector) {
      await session.page.waitForSelector(selector, { timeout: 10000 });
      const html = await session.page.$eval(selector, el => el.outerHTML);
      return html;
    }
    
    const html = await session.page.content();
    return html;
  }

  /**
   * Execute JavaScript in the browser
   */
  async evaluate(code: string, sessionId?: string): Promise<any> {
    const session = this.getSession(sessionId);
    const result = await session.page.evaluate((code) => {
      return eval(code);
    }, code);
    return result;
  }

  /**
   * Wait for a selector to appear
   */
  async waitForSelector(selector: string, timeout: number = 10000, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.page.waitForSelector(selector, { timeout });
    return `Element found: ${selector}`;
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.page.waitForNavigation({ waitUntil: 'networkidle2' });
    return 'Navigation completed';
  }

  /**
   * Get current URL
   */
  async getUrl(sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    return session.page.url();
  }

  /**
   * Get page title
   */
  async getTitle(sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    return session.page.title();
  }

  /**
   * Fill a form
   */
  async fillForm(formData: Record<string, string>, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    
    for (const [selector, value] of Object.entries(formData)) {
      await session.page.waitForSelector(selector, { timeout: 10000 });
      await session.page.type(selector, value);
    }
    
    return `Filled form with ${Object.keys(formData).length} fields`;
  }

  /**
   * Scroll page
   */
  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', amount?: number, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    
    switch (direction) {
      case 'top':
        await session.page.evaluate(() => window.scrollTo(0, 0));
        break;
      case 'bottom':
        await session.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        break;
      case 'up':
        await session.page.evaluate((amt) => window.scrollBy(0, -(amt || 500)), amount);
        break;
      case 'down':
        await session.page.evaluate((amt) => window.scrollBy(0, amt || 500), amount);
        break;
    }
    
    return `Scrolled ${direction}`;
  }

  /**
   * Get all open tabs
   */
  async getTabs(sessionId?: string): Promise<string[]> {
    const session = this.getSession(sessionId);
    const pages = await session.browser.pages();
    return pages.map(p => p.url());
  }

  /**
   * Create a new tab
   */
  async newTab(url?: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    const newPage = await session.browser.newPage();
    
    if (url) {
      await newPage.goto(url, { waitUntil: 'networkidle2' });
    }
    
    // Switch to the new page
    session.page = newPage;
    
    return `New tab created${url ? ` and navigated to ${url}` : ''}`;
  }

  /**
   * Close current tab
   */
  async closeTab(sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    const pages = await session.browser.pages();
    
    if (pages.length > 1) {
      await session.page.close();
      // Switch to first available page
      session.page = pages.find(p => !p.isClosed()) || pages[0];
      return 'Tab closed';
    }
    
    return 'Cannot close the only tab';
  }

  /**
   * Take element screenshot
   */
  async screenshotElement(selector: string, filePath: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.page.waitForSelector(selector, { timeout: 10000 });
    const element = await session.page.$(selector);
    
    if (element) {
      await element.screenshot({ path: filePath });
      return `Element screenshot saved to ${filePath}`;
    }
    
    return 'Element not found';
  }

  /**
   * Get cookies
   */
  async getCookies(sessionId?: string): Promise<any[]> {
    const session = this.getSession(sessionId);
    return session.page.cookies();
  }

  /**
   * Set cookies
   */
  async setCookies(cookies: any[], sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.page.setCookie(...cookies);
    return `Set ${cookies.length} cookies`;
  }

  /**
   * Clear cookies
   */
  async clearCookies(sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    const cookies = await session.page.cookies();
    await session.page.deleteCookie(...cookies);
    return 'Cookies cleared';
  }

  /**
   * Close browser session
   */
  async close(sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);
    await session.browser.close();
    this.sessions.delete(session.sessionId);
    
    if (this.defaultSession?.sessionId === session.sessionId) {
      this.defaultSession = this.sessions.values().next().value || null;
    }
    
    return 'Browser closed';
  }

  /**
   * Close all browser sessions
   */
  async closeAll(): Promise<string> {
    for (const session of this.sessions.values()) {
      await session.browser.close();
    }
    this.sessions.clear();
    this.defaultSession = null;
    return 'All browsers closed';
  }

  /**
   * Get active sessions
   */
  getSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId?: string): any {
    const session = this.getSession(sessionId);
    return {
      sessionId: session.sessionId,
      startTime: session.startTime,
      uptime: Date.now() - session.startTime,
      url: session.page.url(),
    };
  }

  private getSession(sessionId?: string): BrowserSession {
    if (!sessionId && this.defaultSession) {
      return this.defaultSession;
    }
    
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) return session;
    }
    
    throw new Error('No active browser session. Use browser_launch first.');
  }
}

// Global browser controller instance
export const browserController = new BrowserController();
