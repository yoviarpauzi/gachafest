import { createFileRoute } from "@tanstack/react-router";
import { DrawPage } from "../features/draw/DrawPage";

export const Route = createFileRoute("/admin/draw")({
  component: DrawPage,
});
