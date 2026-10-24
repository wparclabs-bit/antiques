// The item dossier's skeleton (ticket 10): the catalog → item tap is the
// family's daily navigation, and the dossier has a distinctive shape —
// mirror it (title + stage stamp, photo hero, tab chips, cards) so the
// frame appears instantly and the real content fills the same silhouette.
// Static frame only: nothing private can flash or go stale.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="flex items-center gap-3">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />
      <div className="flex gap-2">
        <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-16 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-32 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex flex-col gap-6">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    </main>
  );
}
