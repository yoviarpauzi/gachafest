import { useEffect, useState } from "react";
import { Button } from "../../components/Button";

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * The full screen control in the bottom right corner, outside the scaled stage. It is only there while the
 * pointer is moving (`visible`) or while it has the keyboard focus; the F key does the same from anywhere.
 */
export function FullscreenButton({ visible }: { visible: boolean }) {
  const [full, setFull] = useState(() => document.fullscreenElement !== null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    // A refusal (no user gesture, or the browser does not allow it) leaves the screen as it is.
    const result = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    result.catch(() => undefined);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = visible || focused;
  return (
    <div className={`fixed right-6 bottom-6 z-10 transition-opacity duration-300 ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <Button
        variant="secondary"
        onClick={toggle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        tabIndex={0}
        className="bg-black-900/80"
      >
        {full ? "Exit full screen" : "Enter full screen"}
      </Button>
    </div>
  );
}
