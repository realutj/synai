import { useCallback, useRef, useState } from "react";

export function useMouseTracker() {
	const [cursor, setCursor] = useState({ x: 0, y: 0 });
	const lastUpdateRef = useRef(0);

	const onMouseMove = useCallback((event: { x: number; y: number }) => {
		const now = Date.now();
		if (now - lastUpdateRef.current < 30) return;
		lastUpdateRef.current = now;
		setCursor({ x: event.x, y: event.y });
	}, []);

	return { cursor, onMouseMove };
}

export function TrackedRobot(_props: { cursorX?: number; cursorY?: number }) {
	return null;
}
