"use client";

import {
	BookOpen,
	Check,
	Code2,
	GraduationCap,
	HeartHandshake,
	RotateCcw,
	Save,
	Sparkles,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	DEFAULT_PERSONALIZATION,
	LANGUAGE_OPTIONS,
	POPULAR_TECH_STACKS,
	type PersonalizationProfile,
	readStoredPersonalization,
	setStoredPersonalization,
	TONE_OPTIONS,
} from "@/lib/personalization";
import { cn } from "@/lib/utils";
import { PageFrame, PageHeader } from "../page-layout";

const TONE_ICONS = {
	concise: Zap,
	detailed: BookOpen,
	mentor: GraduationCap,
	direct: Code2,
	friendly: HeartHandshake,
} as const;

export function PersonalizationContent() {
	const [profile, setProfile] = useState<PersonalizationProfile>(
		readStoredPersonalization,
	);
	const [savedMessage, setSavedMessage] = useState(false);
	const [customTechInput, setCustomTechInput] = useState("");

	useEffect(() => {
		setProfile(readStoredPersonalization());
	}, []);

	const updateProfileField = useCallback(
		<K extends keyof PersonalizationProfile>(
			field: K,
			value: PersonalizationProfile[K],
		) => {
			setProfile((prev) => {
				const next = { ...prev, [field]: value };
				setStoredPersonalization(next);
				return next;
			});
			setSavedMessage(true);
			const timer = setTimeout(() => setSavedMessage(false), 2000);
			return () => clearTimeout(timer);
		},
		[],
	);

	const handleAddTech = (tech: string) => {
		const trimmed = tech.trim();
		if (!trimmed) return;
		const current = profile.techStack ?? [];
		if (!current.includes(trimmed)) {
			updateProfileField("techStack", [...current, trimmed]);
		}
		setCustomTechInput("");
	};

	const handleRemoveTech = (tech: string) => {
		const current = profile.techStack ?? [];
		updateProfileField(
			"techStack",
			current.filter((item) => item !== tech),
		);
	};

	const handleReset = () => {
		if (
			window.confirm(
				"Are you sure you want to reset all personalization settings to defaults?",
			)
		) {
			setProfile(DEFAULT_PERSONALIZATION);
			setStoredPersonalization(DEFAULT_PERSONALIZATION);
			setSavedMessage(true);
			setTimeout(() => setSavedMessage(false), 2000);
		}
	};

	return (
		<PageFrame>
			<div className="flex items-center justify-between pb-2 border-b">
				<PageHeader
					title="Personalization"
					description="Customize SynAI's personality, communication style, tech stack preferences, and custom instructions."
				/>
				<div className="flex items-center gap-2">
					{savedMessage ? (
						<span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in duration-200">
							<Check className="size-3.5" />
							Saved
						</span>
					) : null}
					<Button
						variant="outline"
						size="sm"
						onClick={handleReset}
						className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
						title="Reset to defaults"
					>
						<RotateCcw className="size-3.5" />
						Reset
					</Button>
				</div>
			</div>

			<section className="max-w-344 space-y-6 pt-4">
				{/* 1. Profile / Identity */}
				<div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
					<div className="flex items-center gap-2">
						<Sparkles className="size-4.5 text-primary" />
						<h3 className="text-base font-semibold text-foreground">
							Profile & Identity
						</h3>
					</div>
					<p className="text-xs text-muted-foreground">
						Basic information SynAI will use to address you and tailor responses.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">
								Your Name / Preferred Name
							</label>
							<Input
								placeholder="e.g., Alex, Jordan"
								value={profile.name ?? ""}
								onChange={(e) => updateProfileField("name", e.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">
								Your Role / Background
							</label>
							<Input
								placeholder="e.g., Full Stack Developer, Student"
								value={profile.role ?? ""}
								onChange={(e) => updateProfileField("role", e.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">
								Response Language
							</label>
							<Select
								value={profile.language ?? "English"}
								onValueChange={(val) => updateProfileField("language", val)}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select language" />
								</SelectTrigger>
								<SelectContent>
									{LANGUAGE_OPTIONS.map((lang) => (
										<SelectItem key={lang.id} value={lang.id}>
											{lang.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{/* 2. Communication Tone / Style */}
				<div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
					<div>
						<h3 className="text-base font-semibold text-foreground">
							Communication Tone & Style
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							The manner and style SynAI will adopt when formulating responses.
						</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
						{TONE_OPTIONS.map((tone) => {
							const isSelected = (profile.tone ?? "concise") === tone.id;
							const Icon = TONE_ICONS[tone.id as keyof typeof TONE_ICONS] ?? Zap;
							return (
								<button
									key={tone.id}
									type="button"
									onClick={() => updateProfileField("tone", tone.id)}
									className={cn(
										"flex flex-col text-left p-3.5 rounded-lg border transition-all cursor-pointer relative",
										isSelected
											? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
											: "border-border bg-background hover:bg-surface-hover/60 hover:border-border/80",
									)}
								>
									<div className="flex items-center justify-between w-full mb-2">
										<div className="flex items-center gap-2">
											<div
												className={cn(
													"p-1.5 rounded-md",
													isSelected
														? "bg-primary text-primary-foreground"
														: "bg-muted text-muted-foreground",
												)}
											>
												<Icon className="size-3.5" />
											</div>
											<span className="text-sm font-semibold text-foreground">
												{tone.title}
											</span>
										</div>
										<Badge
											variant={isSelected ? "default" : "secondary"}
											className="text-[10px] px-1.5 py-0"
										>
											{tone.badge}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground leading-relaxed">
										{tone.description}
									</p>
								</button>
							);
						})}
					</div>
				</div>

				{/* 3. Tech Stack / Preferences */}
				<div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
					<div>
						<h3 className="text-base font-semibold text-foreground">
							Preferred Tech Stack
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							SynAI prioritizes these technologies and frameworks when generating code or architecture.
						</p>
					</div>

					{/* Selected Tags */}
					<div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
						{(profile.techStack ?? []).map((tech) => (
							<span
								key={tech}
								className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20"
							>
								{tech}
								<button
									type="button"
									onClick={() => handleRemoveTech(tech)}
									className="hover:text-destructive p-0.5 rounded-xs transition-colors cursor-pointer"
								>
									<X className="size-3" />
								</button>
							</span>
						))}
						{(profile.techStack ?? []).length === 0 ? (
							<span className="text-xs text-muted-foreground italic">
								No technologies selected yet. Add your preferred stack below.
							</span>
						) : null}
					</div>

					{/* Quick Suggestions & Custom Input */}
					<div className="space-y-2 pt-2 border-t border-border/60">
						<span className="text-xs font-medium text-muted-foreground">
							Quick add:
						</span>
						<div className="flex flex-wrap gap-1.5">
							{POPULAR_TECH_STACKS.map((tech) => {
								const alreadySelected = (profile.techStack ?? []).includes(tech);
								return (
									<button
										key={tech}
										type="button"
										disabled={alreadySelected}
										onClick={() => handleAddTech(tech)}
										className={cn(
											"px-2 py-0.5 text-xs rounded-md border transition-colors",
											alreadySelected
												? "opacity-40 cursor-not-allowed border-transparent bg-muted text-muted-foreground"
												: "bg-background border-border text-foreground hover:bg-surface-hover hover:border-primary/40 cursor-pointer",
										)}
									>
										+ {tech}
									</button>
								);
							})}
						</div>

						<div className="flex items-center gap-2 max-w-sm pt-2">
							<Input
								placeholder="Add custom technology (e.g. Supabase, Astro)..."
								value={customTechInput}
								onChange={(e) => setCustomTechInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleAddTech(customTechInput);
									}
								}}
								className="h-8 text-xs"
							/>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => handleAddTech(customTechInput)}
								className="h-8 text-xs shrink-0"
							>
								Add
							</Button>
						</div>
					</div>
				</div>

				{/* 4. Coding Style / Guidelines */}
				<div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
					<div>
						<h3 className="text-base font-semibold text-foreground">
							Coding Preferences & Conventions
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							Principles and formatting conventions you want SynAI to adhere to.
						</p>
					</div>

					<Input
						placeholder="e.g., Clean code, strict TypeScript, early returns, minimal comments"
						value={profile.codingStyle ?? ""}
						onChange={(e) => updateProfileField("codingStyle", e.target.value)}
					/>
				</div>

				{/* 5. Custom Instructions */}
				<div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
					<div>
						<h3 className="text-base font-semibold text-foreground">
							Custom System Instructions
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							Specific guidelines injected into the system prompt for every session.
						</p>
					</div>

					<Textarea
						rows={5}
						placeholder={`e.g.:\n- Always provide unit tests for new functions.\n- Prefer modern ES modules.\n- Avoid deprecated packages.\n- Explain changes in clear bullet points.`}
						value={profile.customInstructions ?? ""}
						onChange={(e) =>
							updateProfileField("customInstructions", e.target.value)
						}
						className="text-sm leading-relaxed"
					/>
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>
							These directives will automatically be included in SynAI's system prompt across all sessions.
						</span>
						<span>{(profile.customInstructions ?? "").length} characters</span>
					</div>
				</div>
			</section>
		</PageFrame>
	);
}
