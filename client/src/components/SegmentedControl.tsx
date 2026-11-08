import { useId } from "react";

/**
 * Two or more exclusive choices in a pill (the Figma "Segmented control"). Built from native radio inputs,
 * so Tab enters the group, the arrow keys move the choice, and a screen reader announces it as a radio group.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col items-start gap-2">
      <span id={labelId} className="text-label-md text-ink">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        className={`flex gap-1 rounded-full border border-black-700 bg-black-950 p-1 ${disabled ? "opacity-50" : ""}`}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={`rounded-full px-6 py-2 text-label-md outline-offset-2 has-focus-visible:outline-2 has-focus-visible:outline-gold-300 ${
              option.value === value ? "bg-gold-400 text-black-950" : "text-ink"
            } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={option.value === value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint && (
        <p id={hintId} className="text-body-sm text-gold-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
