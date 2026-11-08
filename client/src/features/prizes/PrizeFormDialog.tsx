import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { SegmentedControl } from "../../components/SegmentedControl";
import { TextInput } from "../../components/TextInput";
import { errorBody, errorCode } from "../../lib/api";
import { issueMessage } from "../../lib/form";
import type { Prize } from "./api";
import { formatRupiah, parseRupiah } from "./format";
import { prizeFormSchema, toPrizeInput, type PrizeFormValues } from "./formSchema";
import { useCreatePrizeMutation, useUpdatePrizeMutation } from "./queries";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the name of the prize that was added or saved. */
  onDone: (name: string) => void;
} & ({ mode: "add"; prize?: undefined } | { mode: "edit"; prize: Prize });

/** One form for adding a prize and for editing one; edit starts from the prize's data. */
export function PrizeFormDialog(props: Props) {
  const { open, onClose, onDone } = props;
  return (
    <Modal open={open} onClose={onClose} title={props.mode === "edit" ? "Edit prize" : "Add prize"}>
      <PrizeForm prize={props.prize} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}

const TIER_LOCKED = "The tier can't change once the prize has been drawn.";

// What the server said when it refused a save, so each reason can be shown where it belongs.
type ServerError = { kind: "generic" } | { kind: "below_drawn"; drawn: number } | { kind: "tier_locked" };

const emptyValues: PrizeFormValues = { name: "", value: "", winners: "1", tier: "basic" };

const valuesOf = (prize: Prize): PrizeFormValues => ({
  name: prize.name,
  value: prize.value === null ? "" : formatRupiah(prize.value),
  winners: String(prize.winners),
  tier: prize.tier,
});

function PrizeForm({
  prize,
  onClose,
  onDone,
}: {
  prize?: Prize;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const create = useCreatePrizeMutation();
  const update = useUpdatePrizeMutation();
  const [serverError, setServerError] = useState<ServerError | null>(null);
  // `isPending` lags a tick behind a click, so this ref is the guard against a double submit.
  const submitting = useRef(false);
  const pending = create.isPending || update.isPending;
  // Once a prize has winners its tier is fixed; the server enforces it, this keeps the control from offering it.
  const tierLocked = prize !== undefined && prize.drawn > 0;

  const form = useForm({
    defaultValues: prize ? valuesOf(prize) : emptyValues,
    // Check on submit; after a first failed submit, check again on every change. With an `onSubmit`
    // validator alone, editing a field clears its error and an identical message after the next Save is
    // not shown again, so a second Save with another wrong value did nothing visible.
    validationLogic: revalidateLogic(),
    validators: { onDynamic: prizeFormSchema },
    onSubmit: async ({ value }) => {
      if (submitting.current) return;
      submitting.current = true;
      setServerError(null);
      try {
        const input = toPrizeInput(value);
        const saved = prize
          ? await update.mutateAsync({ id: prize.id, ...input })
          : await create.mutateAsync(input);
        onDone(saved.name);
      } catch (error) {
        const code = errorCode(error);
        if (code === "below_drawn") {
          setServerError({ kind: "below_drawn", drawn: Number(errorBody(error)?.drawn) || 0 });
        } else {
          setServerError({ kind: code === "tier_locked" ? "tier_locked" : "generic" });
        }
      } finally {
        submitting.current = false;
      }
    },
  });

  return (
    <form
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextInput
            label="Prize name"
            name={field.name}
            autoComplete="off"
            hint="Shown on the big screen above the winner."
            value={field.state.value}
            disabled={pending}
            error={issueMessage(field.state.meta.errors[0])}
            onBlur={field.handleBlur}
            onChange={(event) => {
              setServerError(null);
              field.handleChange(event.target.value);
            }}
          />
        )}
      </form.Field>

      <form.Field name="value">
        {(field) => (
          <TextInput
            label="Prize value in Rupiah (optional)"
            name={field.name}
            inputMode="numeric"
            autoComplete="off"
            hint="Leave empty to hide the value."
            value={field.state.value}
            disabled={pending}
            error={issueMessage(field.state.meta.errors[0])}
            onBlur={() => {
              // A valid amount is shown the way the table shows it; anything else is left for the organizer to fix.
              const parsed = parseRupiah(field.state.value);
              if (parsed.kind === "ok") field.handleChange(formatRupiah(parsed.value));
              else if (parsed.kind === "empty") field.handleChange("");
              field.handleBlur();
            }}
            onChange={(event) => {
              setServerError(null);
              field.handleChange(event.target.value);
            }}
          />
        )}
      </form.Field>

      <form.Field name="winners">
        {(field) => (
          <TextInput
            label="Number of winners"
            name={field.name}
            inputMode="numeric"
            autoComplete="off"
            hint="At least 1, and never fewer than the winners already drawn."
            value={field.state.value}
            disabled={pending}
            error={
              issueMessage(field.state.meta.errors[0]) ??
              (serverError?.kind === "below_drawn"
                ? `${serverError.drawn} already drawn; it can't go below that.`
                : undefined)
            }
            onBlur={field.handleBlur}
            onChange={(event) => {
              setServerError(null);
              field.handleChange(event.target.value);
            }}
          />
        )}
      </form.Field>

      <form.Field name="tier">
        {(field) => (
          <SegmentedControl
            label="Reveal tier"
            hint={tierLocked ? TIER_LOCKED : "Premium plays the full cinematic reveal. Basic is shorter."}
            value={field.state.value}
            options={[
              { value: "basic", label: "Basic" },
              { value: "premium", label: "Premium" },
            ]}
            disabled={pending || tierLocked}
            onChange={(tier) => {
              setServerError(null);
              field.handleChange(tier);
            }}
          />
        )}
      </form.Field>

      {(serverError?.kind === "generic" || serverError?.kind === "tier_locked") && (
        <p role="alert" className="text-body-sm text-error">
          {serverError.kind === "tier_locked" ? TIER_LOCKED : "Something went wrong. Try again."}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "Saving..." : "Save prize"}
        </Button>
      </div>
    </form>
  );
}
