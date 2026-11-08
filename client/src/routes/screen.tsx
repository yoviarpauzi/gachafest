import { createFileRoute } from "@tanstack/react-router";
import { ScreenError } from "../features/screen/ScreenError";
import { ScreenPage } from "../features/screen/ScreenPage";

// Public on purpose: no login, so the projector window needs no session.
export const Route = createFileRoute("/screen")({
  component: ScreenPage,
  errorComponent: ScreenError,
});
