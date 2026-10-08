"use client";

import { type ReactNode, useId } from "react";

export type AgentApprovalAction = "approve" | "reject";

export interface AgentApprovalCardProps {
	description?: ReactNode;
	detail?: ReactNode;
	error?: ReactNode;
	meta?: ReactNode;
	onApprove: () => void;
	onReject: () => void;
	responding?: AgentApprovalAction;
	title: ReactNode;
}

function Spinner() {
	return (
		<svg
			aria-hidden="true"
			className="synai-ui-agent-approval-card__spinner mr-1 size-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] stroke-2"
			viewBox="0 0 24 24"
		>
			<path d="M21 12a9 9 0 1 1-6.219-8.56" />
		</svg>
	);
}

export function AgentApprovalCard({
	description,
	detail,
	error,
	meta,
	onApprove,
	onReject,
	responding,
	title,
}: AgentApprovalCardProps) {
	const titleId = useId();
	const isPending = responding !== undefined;

	return (
		<section
			aria-busy={isPending || undefined}
			aria-labelledby={titleId}
			className="synai-ui-agent-approval-card rounded-synai-ui-lg border border-synai-ui-border/80 bg-synai-ui-background/70 p-3"
		>
			<div className="synai-ui-agent-approval-card__header flex items-center justify-between gap-2">
				<div
					className="synai-ui-agent-approval-card__title font-synai-ui-medium text-synai-ui-foreground text-synai-ui-sm"
					id={titleId}
				>
					{title}
				</div>
				{meta ? (
					<div className="synai-ui-agent-approval-card__meta inline-flex items-center gap-1 text-[11px] text-synai-ui-muted-foreground">
						{meta}
					</div>
				) : null}
			</div>
			{description ? (
				<div className="synai-ui-agent-approval-card__description mt-1 text-[11px] text-synai-ui-muted-foreground">
					{description}
				</div>
			) : null}
			{detail != null ? (
				<pre className="synai-ui-agent-approval-card__detail max-h-44 max-w-full">
					{detail}
				</pre>
			) : null}
			{error ? (
				<div className="synai-ui-agent-approval-card__error">{error}</div>
			) : null}
			<div className="synai-ui-agent-approval-card__actions">
				<button
					className="synai-ui-agent-approval-card__button synai-ui-agent-approval-card__button--approve inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-synai-ui-md border-0 bg-synai-ui-primary px-3 font-synai-ui-medium text-synai-ui-primary-foreground transition-[color,background-color,border-color,box-shadow] duration-150 ease-[ease] [&:hover]:bg-synai-ui-primary/90 focus-visible:outline-3 focus-visible:outline-synai-ui-ring/50 focus-visible:outline-offset-0 disabled:pointer-events-none disabled:opacity-50"
					disabled={isPending}
					onClick={onApprove}
					type="button"
				>
					{responding === "approve" ? (
						<>
							<Spinner />
							Approving...
						</>
					) : (
						"Approve"
					)}
				</button>
				<button
					className="synai-ui-agent-approval-card__button synai-ui-agent-approval-card__button--reject inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-synai-ui-md border border-synai-ui-border bg-synai-ui-background px-3 font-synai-ui-medium text-synai-ui-foreground shadow-xs transition-[color,background-color,border-color,box-shadow] duration-150 ease-[ease] [&:hover]:bg-synai-ui-accent [&:hover]:text-synai-ui-accent-foreground focus-visible:outline-3 focus-visible:outline-synai-ui-ring/50 focus-visible:outline-offset-0 disabled:pointer-events-none disabled:opacity-50 synai-ui-dark:border-synai-ui-input synai-ui-dark:bg-synai-ui-input/30 synai-ui-dark:[&:hover]:bg-synai-ui-input/50"
					disabled={isPending}
					onClick={onReject}
					type="button"
				>
					{responding === "reject" ? (
						<>
							<Spinner />
							Rejecting...
						</>
					) : (
						"Reject"
					)}
				</button>
			</div>
		</section>
	);
}
