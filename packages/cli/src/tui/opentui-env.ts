/**
 * OpenTUI probes Kitty graphics support during startup. In some terminals that
 * probe response can leak into the visible CLI as text like:
 * Gi=31337, s=1, v=1, a=q, t=d, f=24; AAAA
 *
 * The report looked related to mouse handling because it appeared while the
 * home screen robot was tracking cursor movement. We still need OpenTUI mouse
 * movement detection for that robot follow animation, so do not disable mouse
 * support or enableMouseMovement. Instead, disable only the Kitty graphics
 * capability probe that produces the leaked response.
 *
 * Implications: keyboard input, mouse clicks, mouse movement, colors, Unicode
 * text rendering, ASCII art, and the regular OpenTUI renderer all stay enabled.
 * OpenTUI renderers created after this point will not detect or use Kitty
 * inline bitmap graphics, and child processes may inherit this env var if they
 * are spawned with the default environment. The CLI currently renders text and
 * ASCII frames, including the robot animation, so Kitty bitmap graphics are not
 * used here.
 */
import { ensureSpinnerRegistered } from "./spinner-register";
import { BorderChars, BorderCharArrays } from "@opentui/core";

export function configureTerminalBorders(): void {
	if (process.platform === "win32" && !process.env.WT_SESSION && !process.env.TERM_PROGRAM) {
		try {
			if (BorderCharArrays?.rounded && BorderCharArrays?.single) {
				BorderCharArrays.rounded.set(BorderCharArrays.single);
			}
			if (BorderChars?.rounded && BorderChars?.single) {
				Object.assign(BorderChars.rounded, BorderChars.single);
			}
		} catch {}
	}
}

export function disableOpenTuiGraphicsProbe(): void {
	process.env.OPENTUI_GRAPHICS = "0";
	process.env.OTUI_USE_CONSOLE = "false";
	process.env.SHOW_CONSOLE = "false";
	configureTerminalBorders();
	try {
		ensureSpinnerRegistered();
	} catch {}
}

export function disableOpenTuiConsole(): void {
	process.env.OTUI_USE_CONSOLE = "false";
	process.env.SHOW_CONSOLE = "false";
	configureTerminalBorders();
}

// Ensure console overlay is disabled and safe borders configured upon importing
disableOpenTuiConsole();

