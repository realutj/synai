const workflowExamples = {
	map: {
		command: "synai /map",
		title: "Understand the project first.",
		copy: "SynAI maps entry points, modules, and test paths without changing files.",
		steps: [
			["Entry points and project commands", "find"],
			["Data flow between modules", "trace"],
			["Test structure and verification steps", "summarize"],
		],
	},
	review: {
		command: "synai /review",
		title: "Don't skim the diff.",
		copy: "Review changes and surrounding code. Report findings by severity without modifying files.",
		steps: [
			["Review the current changes", "diff"],
			["Check call sites and error paths", "trace"],
			["Report findings with file and line references", "report"],
		],
	},
	browser: {
		command: "synai browser example.com --inspect",
		title: "Inspect the page with your code.",
		copy: "Open a page in Chrome or Edge and review its headings, forms, and interactive elements.",
		steps: [
			["Review page text and controls", "read"],
			["Find interactions in the user flow", "inspect"],
			["Add a screenshot to project context", "attach"],
		],
	},
};

function updateTabSelection(tabs, selected) {
	for (const tab of tabs) {
		const isSelected = tab === selected;
		tab.setAttribute("aria-selected", String(isSelected));
		tab.tabIndex = isSelected ? 0 : -1;
	}
}

function makeWorkflowRow([description, action], index) {
	const row = document.createElement("div");
	const number = document.createElement("span");
	number.className = "output-index";
	number.textContent = String(index + 1).padStart(2, "0");
	const text = document.createElement("span");
	text.textContent = description;
	const verb = document.createElement("b");
	verb.textContent = action;
	row.append(number, text, verb);
	return row;
}

const workflowTabs = [...document.querySelectorAll("[data-workflow]")];
const workflowPanel = document.querySelector("[data-workflow-panel]");

function selectWorkflow(name, focus = false) {
	const example = workflowExamples[name];
	const tab = workflowTabs.find((candidate) => candidate.dataset.workflow === name);
	if (!example || !tab || !workflowPanel) return;
	updateTabSelection(workflowTabs, tab);
	if (focus) tab.focus();
	workflowPanel.dataset.workflowPanel = name;
	workflowPanel.querySelector("[data-workflow-command]").textContent = example.command;
	workflowPanel.querySelector("[data-workflow-title]").textContent = example.title;
	workflowPanel.querySelector("[data-workflow-copy]").textContent = example.copy;
	workflowPanel.querySelector("[data-workflow-output]").replaceChildren(
		...example.steps.map(makeWorkflowRow),
	);
}

workflowTabs.forEach((tab, index) => {
	tab.addEventListener("click", () => selectWorkflow(tab.dataset.workflow));
	tab.addEventListener("keydown", (event) => {
		let nextIndex;
		if (event.key === "ArrowRight") nextIndex = (index + 1) % workflowTabs.length;
		if (event.key === "ArrowLeft") nextIndex = (index - 1 + workflowTabs.length) % workflowTabs.length;
		if (event.key === "Home") nextIndex = 0;
		if (event.key === "End") nextIndex = workflowTabs.length - 1;
		if (nextIndex === undefined) return;
		event.preventDefault();
		selectWorkflow(workflowTabs[nextIndex].dataset.workflow, true);
	});
});

const installTabs = [...document.querySelectorAll(".install-tab")];

function selectInstall(tab, focus = false) {
	const selectedPanel = document.getElementById(tab.getAttribute("aria-controls"));
	if (!selectedPanel) return;
	updateTabSelection(installTabs, tab);
	for (const candidate of installTabs) {
		const panel = document.getElementById(candidate.getAttribute("aria-controls"));
		if (panel) panel.hidden = panel !== selectedPanel;
	}
	if (focus) tab.focus();
}

installTabs.forEach((tab, index) => {
	tab.addEventListener("click", () => selectInstall(tab));
	tab.addEventListener("keydown", (event) => {
		let nextIndex;
		if (event.key === "ArrowRight") nextIndex = (index + 1) % installTabs.length;
		if (event.key === "ArrowLeft") nextIndex = (index - 1 + installTabs.length) % installTabs.length;
		if (event.key === "Home") nextIndex = 0;
		if (event.key === "End") nextIndex = installTabs.length - 1;
		if (nextIndex === undefined) return;
		event.preventDefault();
		selectInstall(installTabs[nextIndex], true);
	});
});

async function copyText(text) {
	if (navigator.clipboard?.writeText && window.isSecureContext) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const input = document.createElement("textarea");
	input.value = text;
	input.setAttribute("readonly", "");
	input.style.position = "fixed";
	input.style.opacity = "0";
	document.body.append(input);
	input.select();
	const copied = document.execCommand("copy");
	input.remove();
	if (!copied) throw new Error("Clipboard access is unavailable");
}

document.querySelectorAll("[data-copy]").forEach((button) => {
	button.addEventListener("click", async () => {
		const originalText = button.textContent;
		const originalLabel = button.getAttribute("aria-label");
		try {
			await copyText(button.dataset.copy ?? "");
			button.textContent = "COPIED";
			button.setAttribute("aria-label", "Command copied to clipboard");
			button.dataset.copyState = "success";
		} catch {
			button.textContent = "COPY FAILED";
			button.setAttribute("aria-label", "Could not copy command");
			button.dataset.copyState = "error";
		}
		window.setTimeout(() => {
			button.textContent = originalText;
			button.removeAttribute("data-copy-state");
			if (originalLabel) button.setAttribute("aria-label", originalLabel);
		}, 1800);
	});
});

const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector("#nav-links");

function setMenuOpen(open) {
	menuToggle?.setAttribute("aria-expanded", String(open));
	menuToggle?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
	navLinks?.classList.toggle("is-open", open);
}

menuToggle?.addEventListener("click", () => {
	setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});
navLinks?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuOpen(false)));
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") setMenuOpen(false);
});

const year = document.querySelector("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());

for (const link of document.querySelectorAll('a[href^="#"]')) {
	link.addEventListener("click", (event) => {
		const hash = link.getAttribute("href");
		if (!hash || hash === "#") return;
		const target = document.querySelector(hash);
		if (!target) return;
		event.preventDefault();
		target.scrollIntoView({
			behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
			block: "start",
		});
		setMenuOpen(false);
	});
}
