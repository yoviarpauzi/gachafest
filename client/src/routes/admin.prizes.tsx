import { createFileRoute } from "@tanstack/react-router";
import { PrizesPage } from "../features/prizes/PrizesPage";

export const Route = createFileRoute("/admin/prizes")({
  component: PrizesPage,
});
