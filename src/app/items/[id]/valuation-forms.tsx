"use client";

import { useActionState } from "react";
import {
  addComparable,
  removeComparable,
  setValuation,
  type ActionState,
} from "@/lib/valuation/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/catalog/display";
import { FormError } from "../form-error";

// Owner-only pricing forms on the item page. Each is its own <form> so one
// pending submit never blocks the others.

const initial: ActionState = { error: null };

export function AddComparableForm({ itemId }: { itemId: string }) {
  const [state, formAction, pending] = useActionState(addComparable, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="comp-source">Sold where</Label>
          <Input
            id="comp-source"
            name="source"
            required
            maxLength={200}
            placeholder="e.g. eBay, Catawiki"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="comp-soldon">Sold on</Label>
          <Input id="comp-soldon" name="soldOn" type="date" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="comp-price">Sold price</Label>
          <Input
            id="comp-price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
            placeholder="e.g. 129.99"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="comp-currency">Currency</Label>
          <select
            id="comp-currency"
            name="currency"
            defaultValue="USD"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comp-url">Link (optional)</Label>
        <Input
          id="comp-url"
          name="url"
          type="url"
          placeholder="https://…"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comp-notes">Notes (optional)</Label>
        <Input
          id="comp-notes"
          name="notes"
          maxLength={200}
          placeholder="e.g. Same size, restained top."
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Add comparable"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

export function RemoveComparableButton({ comparableId }: { comparableId: string }) {
  const [state, formAction, pending] = useActionState(removeComparable, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="comparableId" value={comparableId} />
      <Button
        type="submit"
        variant="destructive"
        size="xs"
        disabled={pending}
        aria-label="Remove this comparable"
      >
        {pending ? "…" : "Remove"}
      </Button>
      {state.error ? <FormError message={state.error} /> : null}
    </form>
  );
}

export function SetValuationForm({
  itemId,
  currency,
}: {
  itemId: string;
  currency: string | null;
}) {
  const [state, formAction, pending] = useActionState(setValuation, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="val-min">Minimum</Label>
          <Input
            id="val-min"
            name="minPrice"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="val-max">Maximum</Label>
          <Input
            id="val-max"
            name="maxPrice"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="val-currency">Currency</Label>
          <select
            id="val-currency"
            name="currency"
            defaultValue={currency ?? "USD"}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Setting…" : "Set valuation"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Your decision, informed by the comparables above. Every change is kept
        as history.
      </p>
      <FormError message={state.error} />
    </form>
  );
}
