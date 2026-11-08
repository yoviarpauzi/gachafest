import { useForm } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { TextInput } from "../../components/TextInput";
import { issueMessage } from "../../lib/form";
import { errorCode } from "./api";
import { addParticipantSchema } from "./addSchema";
import { useAddParticipantMutation } from "./queries";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the name of the participant that was added. */
  onAdded: (name: string) => void;
};

export function AddParticipantDialog({ open, onClose, onAdded }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Add participant">
      <AddParticipantForm onClose={onClose} onAdded={onAdded} />
    </Modal>
  );
}

function AddParticipantForm({ onClose, onAdded }: Omit<Props, "open">) {
  const add = useAddParticipantMutation();
  const [serverError, setServerError] = useState<"email_taken" | "generic" | null>(null);
  // `isPending` lags a tick behind a click, so this ref is the guard against a double submit.
  const submitting = useRef(false);
  const pending = add.isPending;

  const form = useForm({
    defaultValues: { name: "", email: "" },
    validators: { onSubmit: addParticipantSchema },
    onSubmit: async ({ value }) => {
      if (submitting.current) return;
      submitting.current = true;
      setServerError(null);
      try {
        const participant = await add.mutateAsync(value);
        onAdded(participant.name);
      } catch (error) {
        setServerError(errorCode(error) === "email_taken" ? "email_taken" : "generic");
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
            label="Name"
            name={field.name}
            autoComplete="off"
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

      <form.Field name="email">
        {(field) => (
          <TextInput
            label="Email"
            name={field.name}
            type="email"
            inputMode="email"
            autoComplete="off"
            hint="Each email is one entry in the draw."
            value={field.state.value}
            disabled={pending}
            error={
              issueMessage(field.state.meta.errors[0]) ??
              (serverError === "email_taken" ? "That email is already in the list." : undefined)
            }
            onBlur={field.handleBlur}
            onChange={(event) => {
              setServerError(null);
              field.handleChange(event.target.value);
            }}
          />
        )}
      </form.Field>

      {serverError === "generic" && (
        <p role="alert" className="text-body-sm text-error">
          Something went wrong. Try again.
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "Adding..." : "Add participant"}
        </Button>
      </div>
    </form>
  );
}
