"use client";

import { useActionState, useState } from "react";
import {
  recordListing,
  setListingStatus,
  type ActionState,
} from "@/lib/listings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MarketplaceRegion } from "@/generated/prisma/enums";
import { FormError } from "../form-error";

// The listings forms on the item page. Like the other small forms here, each
// is its own <form> so one pending submit never blocks the others.

const initial: ActionState = { error: null };

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export type MarketplaceOption = {
  id: string;
  name: string;
  region: MarketplaceRegion;
  feePercent: number;
};

export function RecordListingForm({
  itemId,
  marketplaces,
  defaultCurrency,
}: {
  itemId: string;
  marketplaces: MarketplaceOption[];
  defaultCurrency: string;
}) {
  const [state, formAction, pending] = useActionState(recordListing, initial);
  const [marketplaceId, setMarketplaceId] = useState("");

  // The currency follows the channel (spec: listing prices in the
  // marketplace's currency) — IDR at home, the FX setting's marketplace
  // currency abroad. The server enforces the same rule.
  const chosen = marketplaces.find((m) => m.id === marketplaceId);
  const currency = chosen
    ? chosen.region === "DOMESTIC"
      ? "IDR"
      : defaultCurrency
    : defaultCurrency;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="currency" value={currency} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="listing-marketplace">Marketplace</Label>
          <select
            id="listing-marketplace"
            name="marketplaceId"
            value={marketplaceId}
            onChange={(event) => setMarketplaceId(event.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              Choose a marketplace…
            </option>
            {marketplaces.map((marketplace) => (
              <option key={marketplace.id} value={marketplace.id}>
                {marketplace.name} —{" "}
                {marketplace.region === "DOMESTIC" ? "domestic" : "international"},{" "}
                {marketplace.feePercent}% fee
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="listing-price">Intended price</Label>
          <Input
            id="listing-price"
            name="price"
            type="number"
            min={0.01}
            step={0.01}
            inputMode="decimal"
            required
            placeholder="e.g. 1250.00"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Currency</Label>
          <p className="flex h-8 items-center text-sm text-muted-foreground">
            {currency}
            {chosen ? "" : " — set by the marketplace you choose"}
          </p>
        </div>
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Adding…" : "Record listing"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

export function ListingStatusButton({
  listingId,
  to,
  label,
}: {
  listingId: string;
  to: "ACTIVE" | "ENDED";
  label: string;
}) {
  const [state, formAction, pending] = useActionState(setListingStatus, initial);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="to" value={to} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
      >
        {pending ? "Working…" : label}
      </Button>
      {state.error ? <FormError message={state.error} /> : null}
    </form>
  );
}

// One action, the whole package on the clipboard: title, description,
// price, and the photo URLs sized for that marketplace.
export function CopyPackageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" size="sm" onClick={copy}>
      {copied ? "Copied ✓" : "Copy package"}
    </Button>
  );
}
