import markUrl from "../assets/wordmark-mark.svg";

export function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <img src={markUrl} alt="" aria-hidden="true" />
      <span className="text-gold-metal font-display text-wordmark">GACHAFEST</span>
    </div>
  );
}
