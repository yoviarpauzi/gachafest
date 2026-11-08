import { createFileRoute } from "@tanstack/react-router";

// Placeholder: the real Draw page replaces this route (organizer sub-project 4).
export const Route = createFileRoute("/admin/draw")({
  component: () => <h1 className="font-display text-heading-lg text-ink">Draw</h1>,
});
