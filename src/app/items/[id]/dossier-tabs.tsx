"use client";

import { useState } from "react";

// The dossier's tab bar (ticket 10): the item page's sections behind a
// small set of labeled tabs, Record first (the family's core act). The
// tab contents are rendered on the server and passed in as nodes; this
// component only decides which one is visible. Chips scroll horizontally
// on a phone.
export function DossierTabs({
  tabs,
}: {
  tabs: { label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Item sections"
        className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            id={`tab-${index}`}
            role="tab"
            aria-selected={active === index}
            aria-controls={`tabpanel-${index}`}
            onClick={() => setActive(index)}
            className={
              active === index
                ? "shrink-0 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-medium text-background"
                : "shrink-0 rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`tabpanel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        {tabs[active].content}
      </div>
    </div>
  );
}
