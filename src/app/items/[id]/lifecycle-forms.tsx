"use client";

import { useActionState, useState } from "react";
import {
  recordSkbcb,
  transitionItem,
  type ActionState,
} from "@/lib/lifecycle/actions";
import { recordSale } from "@/lib/sales/actions";
import { CURRENCIES } from "@/lib/catalog/display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemState } from "@/generated/prisma/enums";
import { FormError } from "../form-error";
import type { MarketplaceOption } from "./listing-forms";

// The lifecycle and export-clearance forms on the item page. Like the other
// small forms here, each is its own <form> so one pending submit never
// blocks the others.

const initial: ActionState = { error: null };

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// The Listed step itself follows the recorded Listings (ticket 06): the
// action demands an active listing and derives domestic/international from
// it — no channel choice here anymore.
export function TransitionForm({
  itemId,
  to,
  label,
}: {
  itemId: string;
  to: ItemState;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(transitionItem, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="to" value={to} />
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

// The Sold step (ticket 07): recording the actual sale — price, currency,
// marketplace, date — IS the transition. `repair` is the archive-mending
// path for pieces marked Sold before sale recording existed: the record is
// attached, the state does not move again.
export function RecordSaleForm({
  itemId,
  marketplaces,
  defaultCurrency,
  repair = false,
}: {
  itemId: string;
  marketplaces: MarketplaceOption[];
  defaultCurrency: string;
  repair?: boolean;
}) {
  const [state, formAction, pending] = useActionState(recordSale, initial);
  const [marketplaceId, setMarketplaceId] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);

  // The currency follows the channel by default — IDR at home, the FX
  // setting's marketplace currency abroad — but stays editable: the sale
  // record holds what the buyer actually paid, in whatever currency that
  // turned out to be.
  function chooseMarketplace(nextId: string) {
    setMarketplaceId(nextId);
    const chosen = marketplaces.find((m) => m.id === nextId);
    if (chosen) {
      setCurrency(chosen.region === "DOMESTIC" ? "IDR" : defaultCurrency);
    }
  }

  // Today, in the browser's own timezone — a sale is usually recorded the
  // day it happens.
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sale-marketplace">Sold on</Label>
          <select
            id="sale-marketplace"
            name="marketplaceId"
            value={marketplaceId}
            onChange={(event) => chooseMarketplace(event.target.value)}
            className={selectClass}
            required
          >
            <option value="" disabled>
              Choose a marketplace…
            </option>
            {marketplaces.map((marketplace) => (
              <option key={marketplace.id} value={marketplace.id}>
                {marketplace.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sale-soldon">Sale date</Label>
          <Input
            id="sale-soldon"
            name="soldOn"
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sale-price">Sale price</Label>
          <Input
            id="sale-price"
            name="price"
            type="number"
            min={0.01}
            step={0.01}
            inputMode="decimal"
            required
            placeholder="e.g. 450.00"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sale-currency">Currency</Label>
          <select
            id="sale-currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className={selectClass}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Recording…" : repair ? "Save sale record" : "Record sale & mark Sold"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {repair
          ? "This piece was marked Sold before sale recording existed — record its sale here to complete its archive."
          : "Recording the sale marks this piece Sold. Its actual price stays in the Catalog forever."}
      </p>
      <FormError message={state.error} />
    </form>
  );
}
