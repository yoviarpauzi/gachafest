import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminLayout } from "../features/admin/AdminLayout";
import { isAuthenticated } from "../features/auth/queries";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    if (!(await isAuthenticated(context.queryClient))) throw redirect({ to: "/login" });
  },
  component: AdminLayout,
});
