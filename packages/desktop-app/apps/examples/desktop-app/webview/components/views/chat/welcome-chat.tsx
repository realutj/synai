"use client";

import type { AgendaTaskRecord } from "@synai/shared";
import { PROMPT_RECIPES } from "@synai/shared/browser";
import { AgentWelcomeHero } from "@synai/ui";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { AgendaTaskReviewDialog } from "@/components/agenda-task-review-dialog";
import { useWorkspace } from "@/contexts/workspace-context";
import { isAgendaTaskExpired, useAgendaTasks } from "@/hooks/use-agenda-tasks";
import { AGENDA_UI_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import { SessionContent } from "./session-content";
import { WelcomeWorkspaceControls } from "./welcome-workspace-controls";
import { WorkspaceTaskTracker } from "./workspace-task-tracker";

export function WelcomeScreen({
	active,
	body,
	composer,
	notice,
	gitBranch,
	onListGitBranches,
	onSwitchGitBranch,
	onOpenSession,
	onFillPrompt,
}: {
	active: boolean;
	body: ReactNode;
	composer: ReactNode;
	/** Rendered above the composer on the welcome state (e.g. setup notice). */
	notice?: ReactNode;
	/** Branch name, "no-git" for a non-repo folder, null while discovery is pending. */
	gitBranch: string | null;
	onListGitBranches: () => Promise<{ current: string; branches: string[] }>;
	onSwitchGitBranch: (branch: string) => Promise<boolean>;
	onOpenSession?: (sessionId: string) => void | Promise<void>;
	/** Fill the composer with a reusable project workflow without sending it. */
	onFillPrompt?: (prompt: string) => void;
}) {
	const {
		workspaceRoot,
		workspaces,
		refreshWorkspaces,
		switchWorkspace,
		pickWorkspaceDirectory,
		selectChat,
	} = useWorkspace();
	const agenda = useAgendaTasks(
		{
			scope: "workspace",
			workspaceRoot,
			types: ["suggestion", "reminder", "follow-up"],
			statuses: ["pending_approval", "approved", "in_progress", "failed"],
			limit: 8,
		},
		AGENDA_UI_ENABLED && active && workspaceRoot.trim().length > 0,
	);
	const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
	const [reviewTask, setReviewTask] = useState<AgendaTaskRecord | null>(null);
	const quickActionTasks = useMemo(
		() => agenda.tasks.filter((task) => !isAgendaTaskExpired(task)).slice(0, 4),
		[agenda.tasks],
	);

	const handleTaskAction = useCallback(
		async (task: AgendaTaskRecord) => {
			setRunningTaskId(task.taskId);
			try {
				if (task.status === "in_progress" && task.lastSessionId) {
					await onOpenSession?.(task.lastSessionId);
					return;
				}
				let runnable = task;
				if (runnable.status === "pending_approval") {
					runnable = await agenda.approveTask(runnable);
				}
				if (runnable.status === "in_progress" && runnable.lastSessionId) {
					await onOpenSession?.(runnable.lastSessionId);
					return;
				}
				if (runnable.status === "approved" || runnable.status === "failed") {
					const started = await agenda.runTask(runnable);
					if (started.lastSessionId) {
						await onOpenSession?.(started.lastSessionId);
					}
				}
			} catch {
				// useAgendaTasks renders the command failure with the quick actions.
			} finally {
				setRunningTaskId(null);
			}
		},
		[agenda.approveTask, agenda.runTask, onOpenSession],
	);

	useEffect(() => {
		if (active) void refreshWorkspaces();
	}, [active, refreshWorkspaces]);

	return (
		<div
			className={cn(
				active
					? "relative h-full min-h-0 overflow-hidden bg-background"
					: "contents",
			)}
		>
			<div
				className={cn(
					active
						? "relative z-10 h-full w-full overflow-x-hidden overflow-y-auto"
						: "contents",
				)}
			>
				<div
					className={cn(
						active
							? "mx-auto flex min-h-full w-full max-w-240 flex-col justify-center px-6 py-16 max-[720px]:px-4 max-[720px]:py-10"
							: "contents",
					)}
				>
					{active ? (
						<div className="synai-view-enter">
							<h1 className="sr-only">What would you like to build?</h1>
							<AgentWelcomeHero />

							<div className="mt-11 flex min-w-0 items-center">
								<WelcomeWorkspaceControls
									currentBranch={gitBranch}
									onListGitBranches={onListGitBranches}
									onPickWorkspaceDirectory={pickWorkspaceDirectory}
									onRefreshWorkspaces={refreshWorkspaces}
									onSelectChat={selectChat}
									onSwitchGitBranch={onSwitchGitBranch}
									onSwitchWorkspace={switchWorkspace}
									workspaceRoot={workspaceRoot}
									workspaces={workspaces}
								/>
							</div>
						</div>
					) : null}

					<div
						className={
							active
								? "hidden"
								: "synai-view-enter h-full min-h-0 overflow-hidden"
						}
						key="conversation-body"
					>
						{body}
					</div>

					{active && notice ? notice : null}

					<div
						className={active ? "mt-4 w-full" : "z-20 shrink-0 px-6 pb-6"}
						key="persistent-composer"
					>
					{active ? composer : <SessionContent>{composer}</SessionContent>}
				</div>

				{active ? (
					<section aria-label="Project workflows" className="synai-view-enter mt-5 w-full">
						<div className="mb-2 flex items-center justify-between gap-3 px-0.5">
							<p className="m-0 text-xs font-medium text-muted-foreground">Start with a workflow</p>
							<p className="m-0 hidden text-[11px] text-muted-foreground sm:block">Also available as slash commands</p>
						</div>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{PROMPT_RECIPES.map((recipe) => (
								<button
									className="group flex min-w-0 items-start justify-between gap-3 rounded-xl border border-border/70 bg-card/55 px-4 py-3 text-left transition-colors hover:border-primary/45 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									key={recipe.name}
									onClick={() => onFillPrompt?.(`/${recipe.name} `)}
									type="button"
								>
									<span className="min-w-0">
										<span className="mb-1 flex items-center gap-2">
											<span className="font-mono text-[11px] text-primary">/{recipe.name}</span>
											<span className="truncate text-sm font-medium text-foreground">{recipe.label}</span>
										</span>
										<span className="block truncate text-xs text-muted-foreground">{recipe.description}</span>
									</span>
									<ArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
								</button>
							))}
						</div>
					</section>
				) : null}

					{active && AGENDA_UI_ENABLED ? (
						<>
							<WorkspaceTaskTracker
								disabled={runningTaskId !== null}
								onSelect={(task) => {
									if (task.status === "pending_approval") {
										setReviewTask(task);
									} else {
										void handleTaskAction(task);
									}
								}}
								tasks={quickActionTasks}
							/>
							<AgendaTaskReviewDialog
								confirmLabel="Approve and start"
								onConfirm={async (task) => {
									await handleTaskAction(task);
									setReviewTask(null);
								}}
								onOpenChange={(open) => {
									if (!open) setReviewTask(null);
								}}
								open={reviewTask !== null}
								pending={runningTaskId === reviewTask?.taskId}
								task={reviewTask}
							/>
							{agenda.error ? (
								<p className="mt-2 text-xs text-destructive" role="alert">
									{agenda.error}
								</p>
							) : null}
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}
