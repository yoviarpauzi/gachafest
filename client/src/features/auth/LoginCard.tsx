import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { TextInput } from "../../components/TextInput";
import { ApiError } from "../../lib/api";
import { useLoginMutation } from "./queries";
import { loginSchema } from "./schema";
import { useRateLimitLock } from "./useRateLimitLock";

function issueMessage(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return undefined;
}

export function LoginCard() {
  const navigate = useNavigate();
  const mutation = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);

  const apiError = mutation.error instanceof ApiError ? mutation.error : null;
  const locked = useRateLimitLock(apiError);
  const disabled = mutation.isPending || locked;

  // Hand focus back to the field (old text selected) once a request or a 429 lock ends,
  // so the organizer can retype right away even after clicking the button.
  const inputRef = useRef<HTMLInputElement>(null);
  const wasDisabled = useRef(false);
  useEffect(() => {
    if (wasDisabled.current && !disabled) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    wasDisabled.current = disabled;
  }, [disabled]);

  // 429 shows the banner while locked and the default look afterwards, never a field message.
  let serverMessage: string | undefined;
  if (mutation.error && apiError?.status !== 429) {
    serverMessage =
      apiError?.status === 401 ? "Incorrect password. Try again." : "Something went wrong. Try again.";
  }

  const submitting = useRef(false);
  const form = useForm({
    defaultValues: { password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      // `isPending` lags a tick behind, so a double click or double Enter would send two requests.
      if (submitting.current) return;
      submitting.current = true;
      try {
        const ok = await mutation.mutateAsync(value).then(
          () => true,
          () => false,
        );
        if (ok) await navigate({ to: "/admin" });
      } finally {
        submitting.current = false;
      }
    },
  });

  return (
    <div className="flex w-full max-w-120 flex-col gap-6 rounded-xl border border-black-700 bg-black-850 p-6 sm:p-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-heading-lg text-ink">Organizer login</h1>
        <p className="text-body-md text-gold-muted">Enter the admin password to manage the draw.</p>
      </div>

      <form
        noValidate
        aria-busy={mutation.isPending}
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {locked && <Alert title="Too many attempts">Wait a minute, then try again.</Alert>}

        <form.Field name="password">
          {(field) => (
            <TextInput
              ref={inputRef}
              label="Password"
              name={field.name}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter password"
              value={field.state.value}
              disabled={disabled}
              error={issueMessage(field.state.meta.errors[0]) ?? serverMessage}
              onBlur={field.handleBlur}
              onChange={(event) => {
                if (mutation.error) mutation.reset();
                field.handleChange(event.target.value);
              }}
              trailing={
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="rounded text-label-md text-gold-400 outline-offset-2 focus-visible:outline-2 focus-visible:outline-gold-300"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              }
            />
          )}
        </form.Field>

        <Button type="submit" disabled={disabled}>
          {mutation.isPending ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <p className="text-center text-body-sm text-gold-muted">
        No password? Ask the person who set up the app.
      </p>
    </div>
  );
}
