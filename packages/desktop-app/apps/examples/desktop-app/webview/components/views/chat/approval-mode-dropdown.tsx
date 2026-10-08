"use client";

import {
	AlertTriangle,
	Check,
	ChevronDown,
	Folder,
	Globe,
	Hand,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	APPROVAL_MODE_CHANGED_EVENT,
	APPROVAL_OPTIONS,
	type ApprovalMode,
	getStoredApprovalMode,
	setStoredApprovalMode,
} from "@/lib/approval-mode";
import { cn } from "@/lib/utils";

function renderOptionIcon(mode: ApprovalMode, className = "size-4") {
	switch (mode) {
		case "ask":
			return <Hand className={cn("shrink-0", className)} />;
		case "approve-for-me":
			return (
				<svg
					className={cn("shrink-0", className)}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
					<path d="m9 10 2 2-2 2" />
					<path d="M13 14h2" />
				</svg>
			);
		case "full-access":
			return (
				<svg
					className={cn("shrink-0 text-orange-500 dark:text-orange-400", className)}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
					<path d="M12 8v4" />
					<path d="M12 16h.01" />
				</svg>
			);
	}
}

export function ApprovalModeDropdown({
	className,
	onChange,
}: {
	className?: string;
	onChange?: (mode: ApprovalMode) => void;
}) {
	const [mode, setMode] = useState<ApprovalMode>(getStoredApprovalMode);
	const [open, setOpen] = useState(false);
	const [confirmFullAccessOpen, setConfirmFullAccessOpen] = useState(false);

	useEffect(() => {
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === "synai.approval-mode.v1" && e.newValue) {
				const val = e.newValue as ApprovalMode;
				if (val === "ask" || val === "approve-for-me" || val === "full-access") {
					setMode(val);
				}
			}
		};
		const handleCustomChange = (e: Event) => {
			const custom = e as CustomEvent<ApprovalMode>;
			if (custom.detail) {
				setMode(custom.detail);
			}
		};

		window.addEventListener("storage", handleStorageChange);
		window.addEventListener(
			APPROVAL_MODE_CHANGED_EVENT,
			handleCustomChange as EventListener,
		);

		return () => {
			window.removeEventListener("storage", handleStorageChange);
			window.removeEventListener(
				APPROVAL_MODE_CHANGED_EVENT,
				handleCustomChange as EventListener,
			);
		};
	}, []);

	const handleSelect = useCallback(
		(nextMode: ApprovalMode) => {
			setMode(nextMode);
			setStoredApprovalMode(nextMode);
			onChange?.(nextMode);
		},
		[onChange],
	);

	const handleItemClick = (optionId: ApprovalMode) => {
		setOpen(false);
		if (optionId === "full-access") {
			if (mode !== "full-access") {
				setConfirmFullAccessOpen(true);
				return;
			}
		}
		handleSelect(optionId);
	};

	const handleConfirmFullAccess = () => {
		handleSelect("full-access");
		setConfirmFullAccessOpen(false);
	};

	const activeOption =
		APPROVAL_OPTIONS.find((opt) => opt.id === mode) ?? APPROVAL_OPTIONS[0];

	return (
		<>
			<DropdownMenu open={open} onOpenChange={setOpen}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className={cn(
							"flex items-center gap-1.5 rounded-md px-2 py-1 text-xs outline-hidden select-none transition-colors hover:bg-surface-hover cursor-pointer",
							mode === "full-access"
								? "text-orange-600 dark:text-orange-400 font-medium"
								: "text-muted-foreground hover:text-foreground font-normal",
							className,
						)}
						title={activeOption.description}
						aria-label={`Command approval: ${activeOption.label}`}
					>
						{renderOptionIcon(mode, "size-3.5")}
						<span className="truncate max-w-[130px]">{activeOption.label}</span>
						<ChevronDown className="size-3 opacity-60 shrink-0" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					sideOffset={6}
					className="w-[340px] max-w-[92vw] p-1.5 rounded-xl border border-border bg-popover shadow-xl z-50"
				>
					{APPROVAL_OPTIONS.map((option) => {
						const isSelected = mode === option.id;
						const isFullAccess = option.id === "full-access";
						return (
							<DropdownMenuItem
								key={option.id}
								onClick={() => handleItemClick(option.id)}
								className={cn(
									"flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors outline-hidden select-none",
									isSelected ? "bg-surface-hover/80" : "hover:bg-surface-hover/50",
								)}
							>
								<div className="shrink-0 mt-0.5">
									{renderOptionIcon(option.id, "size-4.5")}
								</div>
								<div className="flex-1 min-w-0 flex flex-col text-left">
									<span
										className={cn(
											"text-sm font-medium leading-none mb-1",
											isFullAccess
												? "text-orange-600 dark:text-orange-400"
												: "text-foreground",
										)}
									>
										{option.label}
									</span>
									<span
										className={cn(
											"text-xs leading-normal",
											isFullAccess
												? "text-orange-600/85 dark:text-orange-400/85"
												: "text-muted-foreground",
										)}
									>
										{option.description}
									</span>
								</div>
								{isSelected ? (
									<div className="shrink-0 ml-2 self-center">
										<Check
											className={cn(
												"size-4",
												isFullAccess
													? "text-orange-600 dark:text-orange-400"
													: "text-foreground",
											)}
										/>
									</div>
								) : null}
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Full Access Confirmation Modal */}
			<Dialog open={confirmFullAccessOpen} onOpenChange={setConfirmFullAccessOpen}>
				<DialogContent
					showCloseButton={false}
					className="max-w-[480px] p-6 rounded-2xl border border-border bg-background shadow-2xl"
				>
					<div className="space-y-4">
						{/* Title with warning icon */}
						<div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
							<AlertTriangle className="size-5 text-foreground stroke-[2.2] shrink-0" />
							<span>Turn on Full Access?</span>
						</div>

						{/* Description */}
						<p className="text-sm text-muted-foreground leading-relaxed">
							SynAI will be able to run commands, use the internet, and create and edit files anywhere on this computer without your permission. This includes but is not limited to:
						</p>

						{/* Feature Cards Box */}
						<div className="rounded-2xl border border-border/50 bg-muted/30 p-3.5 sm:p-4 space-y-3.5 divide-y divide-border/40">
							{/* 1. Files and folders */}
							<div className="flex items-start gap-3.5 pt-0 first:pt-0">
								<div className="shrink-0 size-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-500">
									<Folder className="size-5 fill-sky-500 text-sky-500" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-foreground">
										Files and folders
									</p>
									<p className="text-xs text-muted-foreground mt-0.5 leading-snug">
										Read, create, modify, upload, or delete files anywhere on this computer
									</p>
								</div>
							</div>

							{/* 2. Terminal commands */}
							<div className="flex items-start gap-3.5 pt-3.5">
								<div className="shrink-0 size-8 rounded-lg bg-neutral-800 dark:bg-neutral-700 flex items-center justify-center text-white">
									<Terminal className="size-4.5" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-foreground">
										Terminal commands
									</p>
									<p className="text-xs text-muted-foreground mt-0.5 leading-snug">
										Run commands, install software, and change system settings
									</p>
								</div>
							</div>

							{/* 3. Internet and connected apps */}
							<div className="flex items-start gap-3.5 pt-3.5">
								<div className="shrink-0 size-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-500">
									<Globe className="size-5" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-foreground">
										Internet and connected apps
									</p>
									<p className="text-xs text-muted-foreground mt-0.5 leading-snug">
										Access websites, send data, and use enabled plugins
									</p>
								</div>
							</div>
						</div>

						{/* Risk warning */}
						<p className="text-xs text-muted-foreground leading-relaxed">
							This comes with risks like loss or exposure of sensitive data and prompt injection. You can turn this off.
						</p>

						{/* Action buttons */}
						<div className="flex items-center justify-end gap-3 pt-2">
							<button
								type="button"
								onClick={() => setConfirmFullAccessOpen(false)}
								className="px-5 py-2 rounded-full text-sm font-medium text-foreground bg-muted/80 hover:bg-muted transition-colors cursor-pointer"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleConfirmFullAccess}
								className="px-5 py-2 rounded-full text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 transition-colors flex items-center gap-1.5 cursor-pointer"
							>
								<AlertTriangle className="size-4" />
								<span>Confirm</span>
							</button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
