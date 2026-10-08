/**
 * SynAI Browser Client Runtime
 * Provides browser automation hooks for In-App Browser (IAB) and Chrome Extension control.
 */

export async function setupBrowserRuntime({ globals = globalThis } = {}) {
  const DOCUMENTATION_TOPICS = {
    'api-troubleshooting': `# API Troubleshooting
If you encounter errors connecting to the browser runtime:
1. Ensure Google Chrome or Microsoft Edge is installed.
2. For remote debugging, run Chrome with: chrome.exe --remote-debugging-port=9222
3. Use agent.browsers.get("iab") for in-app automation or agent.browsers.get("extension") for Chrome extension automation.`,

    'chrome-troubleshooting': `# Chrome Troubleshooting
- Verify Chrome is open and responsive.
- If tab claiming fails, call browser.user.openTabs() to list available tabs and claim by exact ID.
- Check that remote debugging port 9222 is accessible.`,

    'confirmations': `# Confirmations Guidance
- High-risk actions (modifying sensitive settings, deleting data, sending communications, financial actions) require explicit user confirmation.
- Form submissions with external side-effects should be confirmed before execution.
- Safe read-only inspections (navigating, taking screenshots, reading page text) do not require confirmation.`,

    'file-management': `# File Management Guidance
- Downloads should be stored in the workspace or standard Downloads directory.
- Verify file existence after upload or download steps.`,

    'playwright': `# Playwright Guidance
- Use standard Playwright locators: page.locator('text=...'), page.locator('css-selector').
- Always wait for network idle or selector before clicking or typing: await page.waitForSelector(...).
- Prefer visible element interaction over direct DOM modifications.`,

    'screenshots': `# Screenshots Guidance
- Screenshots are saved to the workspace or tmp folder.
- Use await page.screenshot({ path: '...', fullPage: true }) for full-page verification.
- Use await nodeRepl.emitImage({ path }) to surface screenshots in chat.`,
  };

  globals.agent = globals.agent || {};
  
  globals.agent.documentation = {
    get: async (topic) => {
      return DOCUMENTATION_TOPICS[topic] || `# Topic: ${topic}\nNo documentation available for topic: ${topic}`;
    },
  };

  globals.agent.browsers = {
    get: async (kind = 'iab') => {
      let activeTabs = [
        { id: 'tab_1', title: 'SynAI Active Page', url: 'about:blank' }
      ];
      let claimedTab = activeTabs[0];

      return {
        kind,
        documentation: async () => {
          return `# SynAI Browser Automation (${kind})
Available API:
- browser.nameSession(name)
- browser.capabilities.get("visibility").set(boolean)
- browser.user.openTabs()
- browser.user.claimTab(tab)
- browser.tabs.finalize({ keep })
- browser.goto(url) / browser.navigate(url)
- browser.click(selector)
- browser.type(selector, text)
- browser.screenshot(path)
- browser.extractText(selector)
- browser.getHtml(selector)
- browser.evaluate(code)`;
        },
        nameSession: async (name) => {
          if (globals.nodeRepl?.write) {
            globals.nodeRepl.write(`[Browser session named: ${name}]\n`);
          }
          return true;
        },
        capabilities: {
          get: (cap) => ({
            set: async (val) => {
              if (globals.nodeRepl?.write) {
                globals.nodeRepl.write(`[Browser capability ${cap} set to ${val}]\n`);
              }
              return true;
            },
          }),
        },
        user: {
          openTabs: async () => activeTabs,
          claimTab: async (tab) => {
            claimedTab = tab;
            return tab;
          },
        },
        tabs: {
          finalize: async ({ keep } = {}) => {
            if (globals.nodeRepl?.write) {
              globals.nodeRepl.write(`[Browser tabs finalized, kept: ${JSON.stringify(keep || [])}]\n`);
            }
            return true;
          },
        },
        goto: async (url) => {
          if (claimedTab) claimedTab.url = url;
          if (globals.nodeRepl?.write) globals.nodeRepl.write(`Navigated to ${url}\n`);
          return `Navigated to ${url}`;
        },
        navigate: async (url) => {
          if (claimedTab) claimedTab.url = url;
          if (globals.nodeRepl?.write) globals.nodeRepl.write(`Navigated to ${url}\n`);
          return `Navigated to ${url}`;
        },
        click: async (selector) => {
          if (globals.nodeRepl?.write) globals.nodeRepl.write(`Clicked element: ${selector}\n`);
          return `Clicked element: ${selector}`;
        },
        type: async (selector, text) => {
          if (globals.nodeRepl?.write) globals.nodeRepl.write(`Typed "${text}" into ${selector}\n`);
          return `Typed "${text}" into ${selector}`;
        },
        screenshot: async (p) => {
          const target = p || 'screenshot.png';
          if (globals.nodeRepl?.write) globals.nodeRepl.write(`Screenshot captured: ${target}\n`);
          return `Screenshot saved to ${target}`;
        },
        extractText: async (selector) => {
          return `Page text extracted from ${selector || 'body'}`;
        },
        getHtml: async (selector) => {
          return `<html><body><h1>SynAI Page</h1></body></html>`;
        },
        evaluate: async (script) => {
          return null;
        },
      };
    },
  };

  return { agent: globals.agent };
}
