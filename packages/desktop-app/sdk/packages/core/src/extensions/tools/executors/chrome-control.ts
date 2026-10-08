import { existsSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import type { ChromeControlInput, ChromeControlExecutor, ToolOperationResult } from "../types";

const configuredPort = Number.parseInt(process.env.SYNAI_CHROME_DEBUG_PORT ?? "9222", 10);
const DEBUG_PORT = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65536 ? configuredPort : 9222;
let browser: Browser | undefined;
let activePage: Page | undefined;
let ownsBrowser = false;
let browserStart: Promise<Browser> | undefined;

function findChrome(): string | undefined {
	const candidates = process.platform === "win32"
		? [
			"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
			"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
			join(homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
		]
		: process.platform === "darwin"
			? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", join(homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome")]
			: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
	const found = candidates.find(existsSync);
	if (found) return found;

	const locator = process.platform === "win32" ? "where.exe" : "which";
	for (const name of process.platform === "win32"
		? ["chrome.exe", "chrome", "msedge.exe"]
		: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"] ) {
		const resolved = spawnSync(locator, [name], { encoding: "utf8", windowsHide: true });
		const executable = resolved.status === 0 ? resolved.stdout.trim().split(/\r?\n/)[0] : undefined;
		if (executable && existsSync(executable)) return executable;
	}
	return undefined;
}

async function chromeReady(): Promise<boolean> {
	try {
		const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`, { signal: AbortSignal.timeout(1000) });
		return response.ok;
	} catch {
		return false;
	}
}

async function ensureBrowser(): Promise<Browser> {
	if (browser?.connected) return browser;
	if (browserStart) return browserStart;

	const start = (async () => {
		if (await chromeReady()) {
			ownsBrowser = false;
			return puppeteer.connect({ browserURL: `http://127.0.0.1:${DEBUG_PORT}`, defaultViewport: null });
		}
		const executablePath = findChrome();
		if (!executablePath) throw new Error("Google Chrome was not found. Install Chrome or start it with remote debugging enabled.");
		const profile = join(tmpdir(), "synai-chrome-profile");
		mkdirSync(profile, { recursive: true });
		ownsBrowser = true;
		return puppeteer.launch({
			executablePath,
			headless: false,
			defaultViewport: null,
			userDataDir: profile,
			args: [`--remote-debugging-port=${DEBUG_PORT}`, "--no-first-run", "--no-default-browser-check"],
		});
	})();
	browserStart = start;
	try {
		browser = await start;
		return browser;
	} catch (error) {
		ownsBrowser = false;
		throw error;
	} finally {
		if (browserStart === start) browserStart = undefined;
	}
}

async function getPage(): Promise<Page> {
	const currentBrowser = await ensureBrowser();
	if (activePage && !activePage.isClosed() && activePage.browser() === currentBrowser) return activePage;
	const pages = await currentBrowser.pages();
	activePage = pages[0] ?? await currentBrowser.newPage();
	activePage.setDefaultTimeout(12000);
	return activePage;
}

function result(query: string, value: unknown): ToolOperationResult[] {
	return [{ query, result: value, success: true }];
}

export const createChromeControlExecutor = (): ChromeControlExecutor => async (
	input: ChromeControlInput,
): Promise<ToolOperationResult[]> => {
	if (input.action === "close") {
		if (browser?.connected) {
			if (ownsBrowser) await browser.close();
			else await browser.disconnect();
		}
		browser = undefined;
		activePage = undefined;
		ownsBrowser = false;
		return result("close", "Closed the SynAI Chrome session.");
	}
	if (input.action === "tabs") {
		const page = await getPage();
		const pages = await browser!.pages();
		const tabs = await Promise.all(pages.map(async (tab, index) => ({ index, title: await tab.title(), url: tab.url(), active: tab === page })));
		return result("tabs", tabs);
	}
	if (input.action === "new_tab") {
		await getPage();
		activePage = await browser!.newPage();
		activePage.setDefaultTimeout(12000);
		await activePage.bringToFront();
		if (input.url) {
			const url = /^https?:\/\//i.test(input.url) ? input.url : `https://${input.url}`;
			await activePage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
		}
		return result("new_tab", { title: await activePage.title(), url: activePage.url() });
	}
	if (input.action === "select_tab") {
		await getPage();
		const pages = await browser!.pages();
		if (input.tabIndex === undefined || !pages[input.tabIndex]) {
			throw new Error(`A valid tabIndex is required. There are ${pages.length} tab(s).`);
		}
		activePage = pages[input.tabIndex];
		await activePage.bringToFront();
		return result("select_tab", { index: input.tabIndex, title: await activePage.title(), url: activePage.url() });
	}
	const page = await getPage();
	switch (input.action) {
		case "navigate": {
			if (!input.url) throw new Error("A URL is required for navigate.");
			const url = /^https?:\/\//i.test(input.url) ? input.url : `https://${input.url}`;
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
			await page.bringToFront();
			return result("navigate", { title: await page.title(), url: page.url() });
		}
		case "read":
			return result("read", { title: await page.title(), url: page.url(), text: String(await page.evaluate("document.body.innerText")).slice(0, 12000) });
		case "inspect":
			return result("inspect", await page.evaluate(`Array.from(document.querySelectorAll("a,button,input,textarea,select,[role=button]")).slice(0,100).map((node) => ({tag:node.tagName.toLowerCase(),text:(node.innerText||"").trim().slice(0,160),label:node.getAttribute("aria-label"),placeholder:node.placeholder,type:node.type,selector:node.id ? "#"+node.id : node.getAttribute("name") ? "[name=\\\""+node.getAttribute("name")+"\\\"]" : undefined}))`));
		case "click":
			if (!input.selector) throw new Error("A CSS selector is required for click.");
			await page.locator(input.selector).click();
			return result("click", `Clicked ${input.selector}`);
		case "type":
			if (!input.selector || input.text === undefined) throw new Error("A CSS selector and text are required for type.");
			await page.locator(input.selector).fill(input.text);
			return result("type", `Entered text in ${input.selector}`);
		case "fill_form": {
			const fields = Object.entries(input.fields ?? {});
			if (fields.length === 0) throw new Error("At least one CSS selector and value is required in fields.");
			for (const [selector, value] of fields) {
				await page.locator(selector).fill(value);
			}
			return result("fill_form", { filled: fields.map(([selector]) => selector) });
		}
		case "select_option":
			if (!input.selector || input.value === undefined) throw new Error("A CSS selector and value are required for select_option.");
			await page.select(input.selector, input.value);
			return result("select_option", `Selected ${input.value} in ${input.selector}`);
		case "press_key":
			if (!input.key) throw new Error("A key is required for press_key.");
			await page.keyboard.press(input.key as Parameters<Page["keyboard"]["press"]>[0]);
			return result("press_key", `Pressed ${input.key}`);
		case "scroll": {
			const direction = input.direction ?? "down";
			const amount = input.amount ?? 500;
			await page.evaluate((scrollDirection, pixels) => {
				const browserWindow = globalThis as unknown as { scrollBy: (x: number, y: number) => void };
				browserWindow.scrollBy(0, scrollDirection === "down" ? pixels : -pixels);
			}, direction, amount);
			return result("scroll", `Scrolled ${direction} by ${amount}px`);
		}
		case "screenshot": {
			const screenshotPath = join(tmpdir(), `synai-chrome-${Date.now()}.png`);
			await page.screenshot({ path: screenshotPath, fullPage: false });
			return result("screenshot", { path: screenshotPath, title: await page.title(), url: page.url() });
		}
		default:
			throw new Error(`Unsupported Chrome action: ${input.action}`);
	}
};
