"use client";

import { useActionState } from "react";
import {
  addForwarder,
  addForwarderZone,
  addMarketplace,
  removeForwarder,
  removeForwarderRate,
  removeMarketplace,
  updateForwarderRate,
  updateMarketplaceFee,
  updatePricingSettings,
  type ActionState,
  type ForwarderRateView,
  type MarketplaceView,
  type PricingSettingsView,
} from "@/lib/shipping/actions";
import {
  addSocialPlatform,
  removeSocialPlatform,
} from "@/lib/social/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/catalog/display";
import { FormError } from "../items/form-error";

// Settings forms. Each is its own <form> so one pending submit never
// blocks the others.

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

// Add a marketplace the family has started using (ticket 10). The fee is
// optional — leave it empty when unknown; the fee form edits it later.
export function AddMarketplaceForm() {
  const [state, formAction, pending] = useActionState(addMarketplace, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-marketplace-name">Name</Label>
          <Input
            id="new-marketplace-name"
            name="name"
            required
            maxLength={60}
            placeholder="e.g. Catawiki, Shopee"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-marketplace-region">Region</Label>
          <select
            id="new-marketplace-region"
            name="region"
            defaultValue="INTERNATIONAL"
            className={selectClass}
          >
            <option value="INTERNATIONAL">International — prices in the FX currency</option>
            <option value="DOMESTIC">Domestic — prices in IDR</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-marketplace-fee">Fee % (optional)</Label>
          <Input
            id="new-marketplace-fee"
            name="feePercent"
            type="number"
            min={0}
            max={99}
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 12.5"
          />
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Adding…" : "Add marketplace"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

// Remove is refused by the server while any listing or sale references the
// marketplace — the button just carries the answer back.
export function RemoveMarketplaceButton({ marketplaceId }: { marketplaceId: string }) {
  const [state, formAction, pending] = useActionState(removeMarketplace, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="marketplaceId" value={marketplaceId} />
      <Button
        type="submit"
        variant="destructive"
        size="xs"
        disabled={pending}
        aria-label="Remove this marketplace"
      >
        {pending ? "…" : "Remove"}
      </Button>
      {state.error ? <FormError message={state.error} /> : null}
    </form>
  );
}

export function AddSocialPlatformForm() {
  const [state, formAction, pending] = useActionState(addSocialPlatform, initial);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-platform-name">Add a platform</Label>
        <Input
          id="new-platform-name"
          name="name"
          required
          maxLength={60}
          placeholder="e.g. WhatsApp Status, Pinterest"
          className="w-64"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

// Removing a platform only retires it from the posting log's picker; log
// entries keep their recorded text.
export function RemoveSocialPlatformButton({ platformId }: { platformId: string }) {
  const [state, formAction, pending] = useActionState(removeSocialPlatform, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="platformId" value={platformId} />
      <Button
        type="submit"
        variant="destructive"
        size="xs"
        disabled={pending}
        aria-label="Remove this platform"
      >
        {pending ? "…" : "Remove"}
      </Button>
      {state.error ? <FormError message={state.error} /> : null}
    </form>
  );
}

// Add a delivery company with its first quoted zone (ticket 10). The
// advanced numbers — piece limits, volumetric divisor, insurance minimum,
// notes — are edited on the row afterwards.
export function AddForwarderForm() {
  const [state, formAction, pending] = useActionState(addForwarder, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-forwarder-name">Forwarder</Label>
          <Input
            id="new-forwarder-name"
            name="forwarder"
            required
            maxLength={60}
            placeholder="e.g. JNE Express"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-forwarder-zone">First destination zone</Label>
          <Input
            id="new-forwarder-zone"
            name="zone"
            required
            maxLength={60}
            placeholder="e.g. Asia, Europe"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-forwarder-basis">Charges by</Label>
          <select
            id="new-forwarder-basis"
            name="basis"
            defaultValue="PER_KG"
            className={selectClass}
          >
            <option value="PER_KG">Kilogram (express parcel)</option>
            <option value="PER_CUBIC_METER">Cubic meter (sea freight)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-forwarder-rate">Rate (IDR per kg / m³)</Label>
          <Input
            id="new-forwarder-rate"
            name="rateIdr"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            required
            placeholder="e.g. 300000"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-forwarder-insurance">Insurance (% of value)</Label>
          <Input
            id="new-forwarder-insurance"
            name="insurancePercent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 2"
          />
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Adding…" : "Add forwarder"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

// Append a zone to a forwarder the family already uses — a new quote
// arrived for a new destination.
export function AddForwarderZoneForm({ forwarder }: { forwarder: string }) {
  const [state, formAction, pending] = useActionState(addForwarderZone, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="forwarder" value={forwarder} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`zone-${forwarder}`}>Add a zone</Label>
        <Input
          id={`zone-${forwarder}`}
          name="zone"
          required
          maxLength={60}
          placeholder="e.g. Middle East"
          className="w-44"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`zbasis-${forwarder}`}>Charges by</Label>
        <select
          id={`zbasis-${forwarder}`}
          name="basis"
          defaultValue="PER_KG"
          className={selectClass}
        >
          <option value="PER_KG">Kilogram</option>
          <option value="PER_CUBIC_METER">Cubic meter</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`zrate-${forwarder}`}>Rate (IDR)</Label>
        <Input
          id={`zrate-${forwarder}`}
          name="rateIdr"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          required
          className="w-32"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Adding…" : "Add zone"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

// Removing a rate row or a whole forwarder is always safe — estimates
// compute from the table live; nothing references a row.
export function RemoveForwarderRateButton({ rateId }: { rateId: string }) {
  const [state, formAction, pending] = useActionState(removeForwarderRate, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="rateId" value={rateId} />
      <Button
        type="submit"
        variant="destructive"
        size="xs"
        disabled={pending}
        aria-label="Remove this rate row"
      >
        {pending ? "…" : "Remove"}
      </Button>
      {state.error ? <FormError message={state.error} /> : null}
    </form>
  );
}

export function RemoveForwarderButton({ forwarder }: { forwarder: string }) {
  const [state, formAction, pending] = useActionState(removeForwarder, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="forwarder" value={forwarder} />
      <Button type="submit" variant="destructive" size="xs" disabled={pending}>
        {pending ? "Removing…" : "Remove forwarder"}
      </Button>
      {state.error ? <FormError message={state.error} /> : null}
    </form>
  );
}
