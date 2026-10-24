import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getShippingSettings } from "@/lib/shipping/actions";
import { getSocialPlatforms } from "@/lib/social/actions";
import { formatIdr } from "@/lib/catalog/display";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AddMarketplaceForm,
  AddSocialPlatformForm,
  RemoveMarketplaceButton,
  RemoveSocialPlatformButton,
  UpdateMarketplaceFeeForm,
  UpdatePricingSettingsForm,
  UpdateRateForm,
} from "./settings-forms";
import { InviteForm } from "../invite-form";

// The page reads the session cookie, so it must render per request.
export const instant = false;

// Settings (tickets 05 + 10): one page for everything the family configures
// — marketplaces (self-serve), the social platforms the posting log offers,
// forwarder rates, FX & margin, and family invites. Every estimate and
// Price Floor is computed from these numbers.
export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [settings, platforms] = await Promise.all([
    getShippingSettings(),
    getSocialPlatforms(),
  ]);
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
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything the family configures in one place. The numbers start
            from research findings — replace them with real quotes as you
            collect them.
          </p>
          <p className="mt-1 text-sm">
            <Link
              href="/clearance"
              className="text-primary underline-offset-2 hover:underline"
            >
              Export clearance (SKBCB) checklist →
            </Link>
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Marketplaces</CardTitle>
          <CardDescription>
            Every channel the family sells through. Add one whenever you
            start using it — the region decides what currency its listings
            price in, and the fee feeds the Price Floor. A marketplace can
            be removed only while no listing or sale references it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-border">
            {settings.marketplaces.map((marketplace) => (
              <li
                key={marketplace.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <UpdateMarketplaceFeeForm marketplace={marketplace} />
                <RemoveMarketplaceButton marketplaceId={marketplace.id} />
              </li>
            ))}
          </ul>
          <AddMarketplaceForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social platforms</CardTitle>
          <CardDescription>
            The choices the posting log offers when recording where an item
            was marketed. The log itself always accepts anything via
            &ldquo;Other&rdquo; — removing a platform here never rewrites
            history.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-wrap gap-2">
            {platforms.map((platform) => (
              <li
                key={platform.id}
                className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm"
              >
                {platform.name}
                <RemoveSocialPlatformButton platformId={platform.id} />
              </li>
            ))}
          </ul>
          <AddSocialPlatformForm />
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Family</CardTitle>
          <CardDescription>
            Every account has full rights — there are no restricted roles
            (ADR-0003). Share the starting password in person; the app sends
            no email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>
    </main>
  );
}
