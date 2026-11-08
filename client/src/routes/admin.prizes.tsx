import { createFileRoute } from "@tanstack/react-router";

// Placeholder: the real Prizes page replaces this route (organizer sub-project 3).
export const Route = createFileRoute("/admin/prizes")({
  component: () => <h1 className="font-display text-heading-lg text-ink">Prizes</h1>,
});
