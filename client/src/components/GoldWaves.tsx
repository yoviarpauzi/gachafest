import wavesUrl from "../assets/gold-waves.svg";

export function GoldWaves({ className = "" }: { className?: string }) {
  return (
    <img
      src={wavesUrl}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none max-w-none select-none ${className}`}
    />
  );
}
