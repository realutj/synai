# SynAI web visual foundation

The shared visual contract now lives in the internal
[`@synai/ui`](../../../../../sdk/packages/ui/README.md) workspace package
instead of beside the desktop app.

The desktop imports the complete `@synai/ui/theme/index.css` entry point. Other
SynAI surfaces can import `@synai/ui/theme/tokens.css` without React or
Tailwind, or compose the Tailwind adapter and optional base styles in order.
Consuming apps still own their font files and shell-specific layout.
