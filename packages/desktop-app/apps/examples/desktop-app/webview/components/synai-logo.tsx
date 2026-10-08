import { cn } from "@/lib/utils";

export function SynAILogo({ className }: { className?: string }) {
	return (
		<img
			src="/icon.png"
			alt="SynAI"
			aria-hidden="true"
			className={cn("inline-block shrink-0 object-contain", className)}
		/>
	);
}
