import { createFileRoute } from "@tanstack/react-router";

// Renders nothing. vite.config.ts uses this path as the SPA mask, so the
// prerendered _shell.html that every deep link falls back to stays blank
// instead of flashing a real page before the app hydrates.
export const Route = createFileRoute("/app-shell")({
  component: () => null,
});
