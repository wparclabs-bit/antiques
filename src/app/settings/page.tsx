import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getShippingSettings } from "@/lib/shipping/actions";
import { formatIdr } from "@/lib/catalog/display";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  UpdateMarketplaceFeeForm,
  UpdatePricingSettingsForm,
  UpdateRateForm,
} from "./settings-forms";

// The page reads the session cookie, so it must render per request.
export const instant = false;

// Shipping & pricing settings (ticket 05): the editable forwarder rates
// table seeded from the research findings, marketplace fee percentages, and
// the single FX rate + margin the Price Floor uses. Owner-only — this is
// the family's cost picture, like cost basis.
export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "OWNER") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Catalog
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Owner-only</CardTitle>
            <CardDescription>
              Shipping rates, fees, and the FX rate are the family&rsquo;s cost
              settings — they are managed through an Owner login.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const settings = await getShippingSettings();
  if (!settings) {
    redirect("/login");
  }

  const byForwarder = new Map<string, typeof settings.rates>();
  for (const rate of settings.rates) {
    const group = byForwarder.get(rate.forwarder) ?? [];
    group.push(rate);
    byForwarder.set(rate.forwarder, group);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Catalog
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Shipping & pricing settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every estimate and Price Floor is computed from these numbers.
            They start from the research findings — replace them with real
            quotes as you collect them.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>FX rate & margin</CardTitle>
          <CardDescription>
            One editable exchange rate converts IDR costs and
            marketplace-currency prices; both sides are always shown together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePricingSettingsForm settings={settings.settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marketplace fees</CardTitle>
          <CardDescription>
            The fee percentage each marketplace takes of the listing price.
            Fee schedules change — check the marketplace&rsquo;s own pages
            when a sale is close.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {settings.marketplaces.map((marketplace) => (
            <UpdateMarketplaceFeeForm key={marketplace.id} marketplace={marketplace} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Forwarder rates</CardTitle>
          <CardDescription>
            Rate per kilogram (express) or per cubic meter (sea LCL) per
            destination zone, with each forwarder&rsquo;s insurance rate.
            Expand a forwarder to edit its zones.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[...byForwarder.entries()].map(([forwarder, rates]) => (
            <details key={forwarder} className="rounded-lg border border-border">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
                {forwarder}
                <span className="ml-2 font-normal text-muted-foreground">
                  {rates
                    .map(
                      (rate) =>
                        `${rate.zone}: ${formatIdr(rate.rateIdr)} per ${
                          rate.basis === "PER_KG" ? "kg" : "m³"
                        }`
                    )
                    .join(" · ")}
                </span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-border p-4">
                {rates.map((rate) => (
                  <UpdateRateForm key={rate.id} rate={rate} />
                ))}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
