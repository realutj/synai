import { type RefObject, useEffect } from "react";

const POINTER_CONFIG = {
	defaultFrameHeight: 220,
	defaultGridHeight: 520,
} as const;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

const POINTER_PROPERTIES = [
	"--welcome-grid-x",
	"--welcome-grid-y",
] as const;

function resetPointerStyles(element: HTMLDivElement | null): void {
	if (!element) return;
	for (const property of POINTER_PROPERTIES) {
		element.style.removeProperty(property);
	}
}

function getPointerState(
	element: HTMLDivElement,
	clientX: number,
	clientY: number,
) {
	const bounds = element.getBoundingClientRect();
	if (bounds.width <= 0 || bounds.height <= 0) return null;

	const pointerX = clientX - bounds.left;
	const pointerY = clientY - bounds.top;
	const gridBounds = element
		.querySelector<HTMLElement>('[data-welcome-hero-layer="grid"]')
		?.getBoundingClientRect();
	const hasGridBounds =
		gridBounds !== undefined && gridBounds.width > 0 && gridBounds.height > 0;
	const gridX = hasGridBounds
		? `${(
				(clamp(clientX - gridBounds.left, 0, gridBounds.width) /
					gridBounds.width) *
					100
			).toFixed(2)}%`
		: `${((clamp(pointerX, 0, bounds.width) / bounds.width) * 100).toFixed(2)}%`;
	const gridY = hasGridBounds
		? `${(
				(clamp(clientY - gridBounds.top, 0, gridBounds.height) /
					gridBounds.height) *
					100
			).toFixed(2)}%`
		: `${(
				clamp(pointerY, 0, POINTER_CONFIG.defaultFrameHeight) +
					(POINTER_CONFIG.defaultGridHeight -
						POINTER_CONFIG.defaultFrameHeight) /
						2
			).toFixed(2)}px`;

	return {
		gridX,
		gridY,
	};
}

export function useAgentWelcomeHeroPointer(
	heroRef: RefObject<HTMLDivElement | null>,
	enabled: boolean,
): void {
	useEffect(() => {
		if (!enabled) return;

		let animationFrame: number | null = null;
		let latestClientX = 0;
		let latestClientY = 0;
		let pointerDirty = false;
		let trackingPointer = false;

		const updatePointerTarget = (hero: HTMLDivElement): boolean => {
			if (!pointerDirty) return false;
			const target = getPointerState(hero, latestClientX, latestClientY);
			pointerDirty = false;
			if (!target) return false;

			hero.style.setProperty("--welcome-grid-x", target.gridX);
			hero.style.setProperty("--welcome-grid-y", target.gridY);
			return true;
		};

		const drawFrame = () => {
			animationFrame = null;
			const hero = heroRef.current;
			if (!hero) return;

			updatePointerTarget(hero);
		};

		const handlePointerMove = (event: PointerEvent) => {
			const hero = heroRef.current;
			if (!hero) return;
			latestClientX = event.clientX;
			latestClientY = event.clientY;
			pointerDirty = true;

			if (typeof window.requestAnimationFrame !== "function") {
				updatePointerTarget(hero);
				return;
			}

			if (animationFrame === null) {
				animationFrame = window.requestAnimationFrame(drawFrame);
			}
		};

		const startPointerTracking = () => {
			if (trackingPointer) return;
			window.addEventListener("pointermove", handlePointerMove, {
				passive: true,
			});
			trackingPointer = true;
		};

		const stopPointerTracking = () => {
			if (trackingPointer) {
				window.removeEventListener("pointermove", handlePointerMove);
				trackingPointer = false;
			}
			if (animationFrame !== null) {
				window.cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}
			pointerDirty = false;
			resetPointerStyles(heroRef.current);
		};

		const motionPreference = window.matchMedia?.(
			"(prefers-reduced-motion: reduce)",
		);
		const syncMotionPreference = () => {
			if (motionPreference?.matches) stopPointerTracking();
			else startPointerTracking();
		};

		syncMotionPreference();
		motionPreference?.addEventListener("change", syncMotionPreference);
		return () => {
			motionPreference?.removeEventListener("change", syncMotionPreference);
			stopPointerTracking();
		};
	}, [enabled, heroRef]);
}
