import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { listNeedsClearance } from "@/lib/lifecycle/actions";
import { categoryLabel, STATE_LABELS } from "@/lib/catalog/display";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// The page reads the session cookie, so it must render per request.
export const instant = false;

// The needs-clearance checklist (ticket 04): every 50+ flagged Item whose
// SKBCB certificate is not fully recorded, so the family can start BPCB/BPK
// assessments in batches — the app tracks certificates, it cannot obtain
// them (ADR-0002).
export default async function ClearancePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const items = await listNeedsClearance();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Catalog
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Needs SKBCB clearance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length === 0
              ? "No Items are waiting on clearance."
              : `${items.length} Item${items.length === 1 ? "" : "s"} flagged 50+ years old ${
                  items.length === 1 ? "needs" : "need"
                } a recorded certificate (number and scan) before going international.`}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing waiting</CardTitle>
            <CardDescription>
              Every flagged Item has its certificate number and scan on
              record. New flagged Items appear here automatically.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="h-full transition-colors hover:border-ring">
                <Link href={`/items/${item.id}`} className="block">
                  <CardContent className="flex gap-4 p-4">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="size-20 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-center text-[0.65rem] leading-tight text-muted-foreground">
                        No photo yet
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="font-medium break-words">
                        {item.name}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">
                          {STATE_LABELS[item.state]}
                        </Badge>
                        <Badge variant="outline">
                          {categoryLabel(item.category)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {item.hasCertificateNumber
                          ? "Scan of the certificate still missing."
                          : "Certificate not started — needs number and scan."}
                      </span>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
