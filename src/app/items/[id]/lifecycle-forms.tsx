"use client";

import { useActionState } from "react";
import {
  recordSkbcb,
  transitionItem,
  type ActionState,
} from "@/lib/lifecycle/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemState } from "@/generated/prisma/enums";
import { FormError } from "../form-error";

// The lifecycle and export-clearance forms on the item page. Like the other
// small forms here, each is its own <form> so one pending submit never
// blocks the others.

const initial: ActionState = { error: null };

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function TransitionForm({
  itemId,
  to,
  label,
  withChannel = false,
}: {
  itemId: string;
  to: ItemState;
  label: string;
  withChannel?: boolean;
}) {
  const [state, formAction, pending] = useActionState(transitionItem, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="to" value={to} />
      {withChannel ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="listing-channel">Where is it being listed?</Label>
          <select
            id="listing-channel"
            name="channel"
            defaultValue=""
            className={selectClass}
          >
            <option value="" disabled>
              Choose a channel…
            </option>
            <option value="domestic">
              Domestic (Indonesia) — no SKBCB needed
            </option>
            <option value="international">
              International — SKBCB certificate must be recorded
            </option>
          </select>
        </div>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Working…" : label}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

export function SkbcbForm({
  itemId,
  certificateNumber,
}: {
  itemId: string;
  certificateNumber: string | null;
}) {
  const [state, formAction, pending] = useActionState(recordSkbcb, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <Label htmlFor="skbcb-number">Certificate number</Label>
      <Input
        id="skbcb-number"
        name="certificateNumber"
        defaultValue={certificateNumber ?? ""}
        placeholder="e.g. SKBCB/2026/DKI/0417"
        aria-invalid={state.error ? true : undefined}
      />
      <Label htmlFor="skbcb-scan">Scan of the certificate</Label>
      <input
        id="skbcb-scan"
        name="scan"
        type="file"
        accept="image/*"
        className="text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Leave the scan empty to keep the one already stored. International
        listing needs both the number and a scan.
      </p>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save certificate"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}
