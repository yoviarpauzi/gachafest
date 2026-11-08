import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "../features/auth/queries";
import { LoginPage } from "../features/auth/LoginPage";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    if (await isAuthenticated(context.queryClient)) throw redirect({ to: "/admin" });
  },
  component: LoginPage,
});
