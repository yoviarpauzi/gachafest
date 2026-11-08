import { getRouteApi } from "@tanstack/react-router";
import { ParticipantsPage } from "./ParticipantsPage";

// getRouteApi avoids importing the route file back into the feature, which would be circular.
const route = getRouteApi("/admin/participants");

export function ParticipantsRoute() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <ParticipantsPage
      search={search}
      onSearchChange={(next) => navigate({ search: next, replace: true })}
    />
  );
}
