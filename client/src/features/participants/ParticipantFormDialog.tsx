import { useForm } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { TextInput } from "../../components/TextInput";
import { issueMessage } from "../../lib/form";
import { errorCode, type Participant } from "./api";
import { participantFormSchema } from "./formSchema";
import {
  useAddParticipantMutation,
  useUpdateParticipantMutation,
} from "./queries";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the name of the participant that was added or saved. */
  onDone: (name: string) => void;
} & (
  | { mode: "add"; participant?: undefined }
  | { mode: "edit"; participant: Participant }
);

/** One form for adding a participant and for editing one; edit starts from the participant's data. */
export function ParticipantFormDialog(props: Props) {
  const { open, onClose, onDone } = props;
  const editing = props.mode === "edit";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit participant" : "Add participant"}
    >
      <ParticipantForm
        participant={props.participant}
        onClose={onClose}
        onDone={onDone}
      />
    </Modal>
  );
}

function ParticipantForm({
  participant,
  onClose,
  onDone,
}: {
  participant?: Participant;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const add = useAddParticipantMutation();
  const update = useUpdateParticipantMutation();
  const [serverError, setServerError] = useState<
    "email_taken" | "generic" | null
  >(null);
  // `isPending` lags a tick behind a click, so this ref is the guard against a double submit.
  const submitting = useRef(false);
  const pending = add.isPending || update.isPending;
  const editing = participant !== undefined;

  const form = useForm({
    defaultValues: {
      name: participant?.name ?? "",
      email: participant?.email ?? "",
    },
    validators: { onSubmit: participantFormSchema },
    onSubmit: async ({ value }) => {
      if (submitting.current) return;
      submitting.current = true;
      setServerError(null);
      try {
        const saved = participant
          ? await update.mutateAsync({ id: participant.id, ...value })
          : await add.mutateAsync(value);
        onDone(saved.name);
      } catch (error) {
        setServerError(
          errorCode(error) === "email_taken" ? "email_taken" : "generic",
        );
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
              (serverError === "email_taken"
                ? "That email is already in the list."
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

      {serverError === "generic" && (
        <p role="alert" className="text-body-sm text-error">
          Something went wrong. Try again.
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button type="submit" size="md" disabled={pending}>
          {pending
            ? editing
              ? "Saving..."
              : "Adding..."
            : editing
              ? "Save changes"
              : "Add participant"}
        </Button>
      </div>
    </form>
  );
}
