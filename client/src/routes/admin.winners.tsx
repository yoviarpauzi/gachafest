import { createFileRoute } from "@tanstack/react-router";
import { WinnersPage } from "../features/winners/WinnersPage";

export const Route = createFileRoute("/admin/winners")({
  component: WinnersPage,
});
