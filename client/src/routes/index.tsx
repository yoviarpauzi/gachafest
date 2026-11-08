import { createFileRoute } from "@tanstack/react-router";

// Placeholder: the real landing page replaces this route.
export const Route = createFileRoute("/")({
  component: () => <h1 className="p-8 font-display text-heading-lg">Gachafest</h1>,
});
