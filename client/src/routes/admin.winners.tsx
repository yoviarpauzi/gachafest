import { createFileRoute } from "@tanstack/react-router";

// Placeholder: the real Winners page replaces this route (organizer sub-project 5).
export const Route = createFileRoute("/admin/winners")({
  component: () => <h1 className="font-display text-heading-lg text-ink">Winners</h1>,
});
