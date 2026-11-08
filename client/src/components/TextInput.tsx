import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

type TextInputProps = {
  label: string;
  error?: string;
  /** Help text under the field; the error replaces it while there is one. */
  hint?: string;
  trailing?: ReactNode;
} & ComponentProps<"input">;

export function TextInput({ label, error, hint, trailing, className = "", ...props }: TextInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-label-md text-ink">
        {label}
      </label>
      <div
        className={`flex h-13 items-center justify-between gap-3 rounded-md bg-black-950 px-4 py-3 focus-within:ring-1 focus-within:ring-gold-400 ${
          error ? "border-2 border-error" : "border border-black-700 focus-within:border-gold-400"
        } ${props.disabled ? "opacity-50" : ""}`}
      >
        <input
          {...props}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 bg-transparent text-body-md text-ink outline-none placeholder:text-gold-muted"
        />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-body-sm text-gold-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
