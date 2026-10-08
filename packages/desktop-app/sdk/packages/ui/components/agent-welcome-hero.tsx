"use client";

import { useRef } from "react";
import { useAgentWelcomeHeroPointer } from "./agent-welcome-hero-pointer.js";

export type AgentWelcomeHeroLayout = "default" | "full-bleed" | "wide-grid";

export interface AgentWelcomeHeroProps {
	interactive?: boolean;
	layout?: AgentWelcomeHeroLayout;
	variant?: "full" | "grid-only" | "bot-only";
}

/** SynAI logo and grid backdrop used on agent welcome surfaces. */
export function AgentWelcomeHero({
	interactive,
	layout = "default",
	variant = "full",
}: AgentWelcomeHeroProps) {
	const heroRef = useRef<HTMLDivElement>(null);
	const showsGrid = variant !== "bot-only";
	const showsBot = variant !== "grid-only";
	const tracksPointer = interactive ?? showsBot;
	useAgentWelcomeHeroPointer(heroRef, tracksPointer);

	return (
		<div
			aria-hidden="true"
			className="synai-ui-agent-welcome-hero"
			data-welcome-hero
			data-welcome-hero-interactive={tracksPointer}
			data-welcome-hero-layout={layout}
			data-welcome-hero-variant={variant}
			ref={heroRef}
		>
			{showsGrid ? (
				<div
					className="synai-ui-agent-welcome-hero__grid"
					data-welcome-hero-layer="grid"
				/>
			) : null}
			{showsBot ? (
				<div
					className="synai-ui-agent-welcome-hero__logo"
					data-welcome-hero-layer="logo"
				>
					<img
						src="/icon.png"
						alt="SynAI"
						className="synai-ui-agent-welcome-hero__logo-img"
						width={96}
						height={96}
					/>
				</div>
			) : null}
		</div>
	);
}
