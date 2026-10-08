export interface AgentQuickAction {
	description: string;
	id: string;
	label: string;
	value: string;
}

export interface AgentQuickActionsProps {
	actions: AgentQuickAction[];
	className?: string;
	disabled?: boolean;
	onSelect: (action: AgentQuickAction) => void;
}

export function AgentQuickActions({
	actions,
	className,
	disabled = false,
	onSelect,
}: AgentQuickActionsProps) {
	if (actions.length === 0) return null;

	return (
		<div
			className={[
				"synai-ui-agent-quick-actions w-full overflow-hidden rounded-synai-ui-xl border border-synai-ui-border/60 bg-synai-ui-background/95 px-2 shadow-sm",
				className,
			]
				.filter(Boolean)
				.join(" ")}
		>
			{actions.map((action) => (
				<button
					className="synai-ui-agent-quick-actions__item flex w-full cursor-pointer items-center justify-between gap-5 rounded-none border-0 bg-transparent p-3 text-left text-inherit transition-[background-color] duration-150 ease-in-out not-last:border-b not-last:border-synai-ui-border/80 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
					disabled={disabled}
					key={action.id}
					onClick={() => onSelect(action)}
					type="button"
				>
					<span className="synai-ui-agent-quick-actions__copy min-w-0">
						<span className="synai-ui-agent-quick-actions__label block font-synai-ui-medium text-[0.9375rem] text-synai-ui-foreground">
							{action.label}
						</span>
						<span className="synai-ui-agent-quick-actions__description mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-synai-ui-muted-foreground text-synai-ui-sm">
							{action.description}
						</span>
					</span>
					<span
						aria-hidden="true"
						className="synai-ui-agent-quick-actions__arrow flex size-7 shrink-0 items-center justify-center rounded-synai-ui-md bg-synai-ui-primary/10 text-synai-ui-primary transition-[background-color,color] duration-150 ease-in-out"
					>
						<svg
							aria-hidden="true"
							className="block size-3"
							fill="none"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							viewBox="0 0 24 24"
						>
							<path d="M5 12h14" />
							<path d="m12 5 7 7-7 7" />
						</svg>
					</span>
				</button>
			))}
		</div>
	);
}
