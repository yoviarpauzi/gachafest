export function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "problem";
}) {
  const problem = tone === "problem";
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-1 rounded-lg border bg-black-850 p-6 ${
        problem ? "border-error" : "border-black-700"
      }`}
    >
      <p className="text-body-sm text-gold-muted">{label}</p>
      <p className={`font-display text-heading-lg ${problem ? "text-error" : "text-ink"}`}>
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}
