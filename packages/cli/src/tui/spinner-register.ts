import * as opentuiReact from "@opentui/react";
import * as opentuiSpinner from "opentui-spinner";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class FallbackSpinnerRenderable {
	private _frameIndex = 0;
	private _intervalId: any = null;
	public name: string = "dots";
	public color: string = "gray";
	public visible: boolean = true;
	public height: number = 1;
	public width: number = 1;
	public x: number = 0;
	public y: number = 0;
	public ctx: any;

	constructor(ctx: any = {}, options: any = {}) {
		this.ctx = ctx;
		this.name = options.name || "dots";
		this.color = options.color || "gray";
		this.start();
	}

	requestRender() {
		try {
			if (typeof this.ctx?.requestRender === "function") {
				this.ctx.requestRender();
			}
		} catch {}
	}

	start() {
		if (this._intervalId) return;
		this._intervalId = setInterval(() => {
			this._frameIndex = (this._frameIndex + 1) % SPINNER_FRAMES.length;
			try {
				this.requestRender();
			} catch {}
		}, 80);
		if (this._intervalId?.unref) {
			this._intervalId.unref();
		}
	}

	stop() {
		if (this._intervalId) {
			clearInterval(this._intervalId);
			this._intervalId = null;
		}
	}

	renderSelf(buffer: any) {
		if (this.visible === false) return;
		const char = SPINNER_FRAMES[this._frameIndex] || "⠋";
		try {
			if (typeof buffer?.drawText === "function") {
				buffer.drawText(char, this.x ?? 0, this.y ?? 0, this.color);
			} else if (typeof buffer?.drawChar === "function") {
				buffer.drawChar(char, this.x ?? 0, this.y ?? 0, this.color);
			}
		} catch {}
	}

	destroySelf() {
		this.stop();
	}
}

export function ensureSpinnerRegistered(): void {
	const SpinnerClass =
		(opentuiSpinner as any).SpinnerRenderable || FallbackSpinnerRenderable;

	try {
		const extendFn = (opentuiReact as any).extend;
		const getCatalogueFn = (opentuiReact as any).getComponentCatalogue;
		if (typeof extendFn === "function") {
			const cat = typeof getCatalogueFn === "function" ? getCatalogueFn() : null;
			if (!cat?.spinner || cat.spinner.name === "TextRenderable") {
				extendFn({ spinner: SpinnerClass });
			}
		}
	} catch {}

	// Register on any other @opentui/react copies in memory (e.g. monorepo duplicate packages)
	try {
		const g = globalThis as any;
		if (typeof g.require !== "undefined" && g.require.cache) {
			for (const key of Object.keys(g.require.cache)) {
				if (key.includes("@opentui") && key.includes("react")) {
					try {
						const mod = g.require.cache[key]?.exports;
						if (mod && typeof mod.extend === "function") {
							const cat = typeof mod.getComponentCatalogue === "function" ? mod.getComponentCatalogue() : null;
							if (!cat?.spinner || cat.spinner.name === "TextRenderable") {
								mod.extend({ spinner: SpinnerClass });
							}
						}
					} catch {}
				}
			}
		}
	} catch {}
}

ensureSpinnerRegistered();
