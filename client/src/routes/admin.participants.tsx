import { createFileRoute } from "@tanstack/react-router";
import { ParticipantsRoute } from "../features/participants/ParticipantsRoute";
import { searchSchema } from "../features/participants/search";

export const Route = createFileRoute("/admin/participants")({
  validateSearch: searchSchema,
  component: ParticipantsRoute,
});
