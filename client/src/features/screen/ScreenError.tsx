import { useEffect } from "react";

const RELOAD_MS = 3000;

/**
 * What the projector shows if the screen ever fails to render: a black window, never an error message, and
 * a reload a moment later, which brings back the current state from the server.
 */
export function ScreenError() {
  useEffect(() => {
    const id = setTimeout(() => window.location.reload(), RELOAD_MS);
    return () => clearTimeout(id);
  }, []);

  return <div className="fixed inset-0 bg-black-950" />;
}
