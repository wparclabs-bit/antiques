import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

// The app's shared navigation (ticket 10): a top bar on desktop, a fixed
// bottom bar on phones — Catalog · Add · Sale log · More, four thumb-sized
// destinations per the platform guidance. Rendered only for a signed-in
// family login; the login page stands alone. Server-rendered: no active
// highlighting, just the links (each page marks where you are with its
// own heading and back links).

const DESTINATIONS = [
  { href: "/sales", label: "Sale log" },
  { href: "/export", label: "Export" },
  { href: "/clearance", label: "Clearance" },
  { href: "/settings", label: "Settings" },
];

export async function AppNav() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <>
      {/* Desktop top bar. */}
      <header className="hidden border-b border-border bg-background sm:block">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Antiques · family archive
          </Link>
          <nav className="flex items-center gap-1">
            {DESTINATIONS.map((destination) => (
              <Button
                key={destination.href}
                variant="ghost"
                size="sm"
                render={<Link href={destination.href} />}
              >
                {destination.label}
              </Button>
            ))}
            <Button size="sm" render={<Link href="/items/new" />}>
              Record an Item
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </nav>
        </div>
      </header>

      {/* Phone bottom bar — fixed, thumb-reachable. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {BOTTOM_DESTINATIONS.map((destination) => (
          <BottomLink key={destination.href} {...destination} />
        ))}
      </nav>
    </>
  );
}

const BOTTOM_DESTINATIONS = [
  { href: "/", label: "Catalog", glyph: "▦" },
  { href: "/items/new", label: "Add", glyph: "+" },
  { href: "/sales", label: "Sale log", glyph: "≡" },
  { href: "/settings", label: "More", glyph: "⚙" },
] as const;

function BottomLink({
  href,
  label,
  glyph,
}: {
  href: string;
  label: string;
  glyph: string;
}) {
  const primary = glyph === "+";
  return (
    <Link
      href={href}
      className={
        primary
          ? "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium"
          : "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs text-muted-foreground"
      }
    >
      {primary ? (
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-foreground text-base leading-none text-background"
        >
          {glyph}
        </span>
      ) : (
        <span aria-hidden className="text-base leading-none">
          {glyph}
        </span>
      )}
      {label}
    </Link>
  );
}
