import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "../features/auth/queries";

// Placeholder: the real organizer pages replace this route. The guard stays.
export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    if (!(await isAuthenticated(context.queryClient))) throw redirect({ to: "/login" });
  },
  component: () => <h1 className="p-8 font-display text-heading-lg">Organizer area</h1>,
});
