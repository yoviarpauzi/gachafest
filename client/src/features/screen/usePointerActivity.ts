import { useEffect, useState } from "react";

/** True while the pointer has moved within the last `idleMs`: used to show controls and the cursor only when someone is there. */
export function usePointerActivity(idleMs: number): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), idleMs);
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearTimeout(timer);
    };
  }, [idleMs]);

  return active;
}
