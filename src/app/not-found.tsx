import Link from "next/link";

// The layout reads the session for the shared nav, so this route renders
// per request like every other (the AppNav guard keeps signed-out visits
// nav-free).
export const instant = false;

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-sm text-muted-foreground">
        That page doesn&rsquo;t exist — the record may have been removed.
      </p>
      <Link
        href="/"
        className="text-sm text-primary underline-offset-2 hover:underline"
      >
        ← Back to the Catalog
      </Link>
    </main>
  );
}
