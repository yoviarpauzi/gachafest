import { createFileRoute } from "@tanstack/react-router";

// Placeholder: the real Participants page replaces this route (organizer sub-project 2).
export const Route = createFileRoute("/admin/participants")({
  component: () => <h1 className="font-display text-heading-lg text-ink">Participants</h1>,
});
