import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { GoldWaves } from "../../components/GoldWaves";
import { IdleView } from "./IdleView";
import { screenQueryOptions } from "./queries";
import { Stage } from "./Stage";
import { useElapsed } from "./useElapsed";
import { deriveView } from "./view";

/** The public big screen: it only reads `/api/screen`, and the organizer's Draw page drives it. */
export function ScreenPage() {
  const queryClient = useQueryClient();
  const screen = useQuery(screenQueryOptions);
  const elapsed = useElapsed(screen.data, screen.dataUpdatedAt);
  const view = deriveView(screen.data, elapsed);

  // A window that was hidden has not been polling on time: ask again the moment it is visible.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void queryClient.refetchQueries({ queryKey: screenQueryOptions.queryKey });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [queryClient]);

  return (
    <main>
      <Stage>
        <GoldWaves className="absolute top-10 -left-12 h-252 w-504" />
        {view.kind === "idle" && <IdleView />}
      </Stage>
    </main>
  );
}
