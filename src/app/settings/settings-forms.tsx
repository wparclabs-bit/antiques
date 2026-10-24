"use client";

import { useActionState } from "react";
import {
  updateForwarderRate,
  updateMarketplaceFee,
  updatePricingSettings,
  type ActionState,
  type ForwarderRateView,
  type MarketplaceView,
  type PricingSettingsView,
} from "@/lib/shipping/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/catalog/display";
import { FormError } from "../items/form-error";

// Owner-only settings forms. Each is its own <form> so one pending submit
// never blocks the others.

const initial: ActionState = { error: null };

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function UpdatePricingSettingsForm({
  settings,
}: {
  settings: PricingSettingsView;
}) {
  const [state, formAction, pending] = useActionState(updatePricingSettings, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fx-currency">Marketplace currency</Label>
          <select
            id="fx-currency"
            name="fxMarketplaceCurrency"
            defaultValue={settings.fxMarketplaceCurrency}
            className={selectClass}
          >
            {CURRENCIES.filter((code) => code !== "IDR").map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fx-rate">FX — IDR per 1 unit</Label>
          <Input
            id="fx-rate"
            name="fxIdrPerUnit"
            type="number"
            min={0.01}
            step="0.01"
            inputMode="decimal"
            required
            defaultValue={settings.fxIdrPerUnit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="margin">Margin on costs (%)</Label>
          <Input
            id="margin"
            name="marginPercent"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
            defaultValue={settings.marginPercent}
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save FX & margin"}
      </Button>
      <p className="text-xs text-muted-foreground">
        The one exchange rate the app uses everywhere — no live currency feeds.
        The margin is added on top of cost basis + shipping + insurance before
        the marketplace fee is divided out.
      </p>
      <FormError message={state.error} />
    </form>
  );
}

export function UpdateMarketplaceFeeForm({
  marketplace,
}: {
  marketplace: MarketplaceView;
}) {
  const [state, formAction, pending] = useActionState(updateMarketplaceFee, initial);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="marketplaceId" value={marketplace.id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`fee-${marketplace.id}`}>
          {marketplace.name} fee (%)
          <span className="ml-1 font-normal text-muted-foreground">
            — {marketplace.region === "DOMESTIC" ? "domestic" : "international"}
          </span>
        </Label>
        <Input
          id={`fee-${marketplace.id}`}
          name="feePercent"
          type="number"
          min={0}
          max={99}
          step="0.01"
          inputMode="decimal"
          required
          defaultValue={marketplace.feePercent}
          className="w-28"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error ? <FormError message={state.error} /> : null}
    </form>
  );
}

export function UpdateRateForm({ rate }: { rate: ForwarderRateView }) {
  const [state, formAction, pending] = useActionState(updateForwarderRate, initial);
  const perKg = rate.basis === "PER_KG";

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <input type="hidden" name="rateId" value={rate.id} />
      <span className="text-sm font-medium">to {rate.zone}</span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rate-${rate.id}`}>Rate (IDR per {perKg ? "kg" : "m³"})</Label>
          <Input
            id={`rate-${rate.id}`}
            name="rateIdr"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            required
            defaultValue={rate.rateIdr}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`ins-pct-${rate.id}`}>Insurance (% of value)</Label>
          <Input
            id={`ins-pct-${rate.id}`}
            name="insurancePercent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            inputMode="decimal"
            required
            defaultValue={rate.insurancePercent}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`ins-min-${rate.id}`}>Insurance min (IDR)</Label>
          <Input
            id={`ins-min-${rate.id}`}
            name="insuranceMinimumIdr"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="none"
            defaultValue={rate.insuranceMinimumIdr ?? ""}
          />
        </div>
        {perKg ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`max-kg-${rate.id}`}>Piece limit (kg)</Label>
              <Input
                id={`max-kg-${rate.id}`}
                name="maxKgPerPiece"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="none"
                defaultValue={rate.maxKgPerPiece ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`divisor-${rate.id}`}>Volumetric divisor</Label>
              <Input
                id={`divisor-${rate.id}`}
                name="volumetricDivisor"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="none"
                defaultValue={rate.volumetricDivisor ?? ""}
              />
            </div>
          </>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`note-${rate.id}`}>Note</Label>
          <Input
            id={`note-${rate.id}`}
            name="transitNote"
            maxLength={200}
            placeholder="e.g. quote date, transit time"
            defaultValue={rate.transitNote ?? ""}
          />
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? "Saving…" : `Save ${rate.zone} rate`}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}
