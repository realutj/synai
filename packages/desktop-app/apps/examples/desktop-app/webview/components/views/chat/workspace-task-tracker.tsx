"use client";

import type { AgendaTaskRecord } from "@synai/shared";
import {
	ArrowRight,
	Circle,
	CircleAlert,
	CircleCheck,
	CircleDot,
	ListChecks,
	LoaderCircle,
} from "lucide-react";

const STATUS_PRESENTATION = {
	pending_approval: {
		label: "Review required",
		action: "Review",
		Icon: CircleAlert,
		iconClass: "text-amber-500",
	},
	approved: {
		label: "Ready to start",
		action: "Start",
		Icon: CircleDot,
		iconClass: "text-primary",
	},
	in_progress: {
		label: "In progress",
		action: "Resume",
		Icon: LoaderCircle,
		iconClass: "animate-spin text-primary",
	},
	failed: {
		label: "Needs attention",
		action: "Retry",
		Icon: CircleAlert,
		iconClass: "text-destructive",
	},
	completed: {
		label: "Completed",
		action: "Open",
		Icon: CircleCheck,
		iconClass: "text-emerald-500",
	},
	cancelled: {
		label: "Cancelled",
		action: "Open",
		Icon: Circle,
		iconClass: "text-muted-foreground",
	},
	expired: {
		label: "Expired",
		action: "Open",
		Icon: Circle,
		iconClass: "text-muted-foreground",
	},
} as const;

function taskKindLabel(task: AgendaTaskRecord): string {
	const kind = task.type === "follow-up" ? "Follow-up" : task.type;
	return `${kind[0]?.toUpperCase()}${kind.slice(1)} · P${task.priority}`;
}

/** Compact, status-aware task rows for the active workspace. */
export function WorkspaceTaskTracker({
	tasks,
	disabled = false,
	onSelect,
}: {
	tasks: AgendaTaskRecord[];
	disabled?: boolean;
	onSelect: (task: AgendaTaskRecord) => void;
}) {
	if (tasks.length === 0) return null;

	const activeCount = tasks.filter(
		(task) => task.status === "in_progress",
	).length;
	const reviewCount = tasks.filter(
		(task) => task.status === "pending_approval",
	).length;

	return (
		<section
			aria-label="Workspace tasks"
			className="synai-view-enter mt-11 w-full overflow-hidden rounded-xl border border-border/70 bg-card/55"
		>
			<header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<ListChecks
						aria-hidden="true"
						className="size-4 shrink-0 text-primary"
					/>
					<div className="min-w-0">
						<h2 className="m-0 text-sm font-medium text-foreground">
							Workspace tasks
						</h2>
						<p className="m-0 text-xs text-muted-foreground">
							{tasks.length} {tasks.length === 1 ? "item" : "items"}
							{activeCount > 0 ? ` · ${activeCount} in progress` : ""}
						</p>
					</div>
				</div>
				{reviewCount > 0 ? (
					<span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
						{reviewCount} to review
					</span>
				) : null}
			</header>

			<div className="divide-y divide-border/60">
				{tasks.map((task) => {
					const presentation = STATUS_PRESENTATION[task.status];
					const Icon = presentation.Icon;
					return (
						<button
							aria-label={`${presentation.action}: ${task.title} (${presentation.label})`}
							className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
							disabled={disabled}
							key={task.taskId}
							onClick={() => onSelect(task)}
							type="button"
						>
							<Icon
								aria-hidden="true"
								className={`size-4 shrink-0 ${presentation.iconClass}`}
							/>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium text-foreground">
									{task.title}
								</span>
								<span className="mt-0.5 block truncate text-xs text-muted-foreground">
									{task.description || taskKindLabel(task)}
								</span>
							</span>
							<span className="hidden shrink-0 text-right sm:block">
								<span className="block text-xs text-muted-foreground">
									{presentation.label}
								</span>
								<span className="mt-0.5 block text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
									{presentation.action}
								</span>
							</span>
							<ArrowRight
								aria-hidden="true"
								className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
							/>
						</button>
					);
				})}
			</div>
		</section>
	);
}
