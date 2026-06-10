"use client";

import { useActionState } from "react";

import type { FormActionState } from "@/switchboard/types";

type Props = {
  action: (
    previousState: FormActionState,
    formData: FormData,
  ) => Promise<FormActionState>;
  idName: string;
  idValue: string;
  label?: string;
};

export function DeleteButton({
  action,
  idName,
  idValue,
  label = "Delete",
}: Props) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      className="sb-delete-form"
      onSubmit={(event) => {
        if (!window.confirm("Delete this record? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input name={idName} type="hidden" value={idValue} />
      <button className="sb-button-danger" disabled={isPending} type="submit">
        {isPending ? "Deleting..." : label}
      </button>
      {state.error ? (
        <span className="sb-delete-error" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
