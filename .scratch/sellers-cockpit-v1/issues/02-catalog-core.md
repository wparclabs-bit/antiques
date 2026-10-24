# 02: Catalog core

**What to build:** Recording an Item end-to-end: an entry form that asks the right attributes for each of the six categories (including manual measurements), photo upload from the phone browser camera with auto-resized marketplace variants, the 50+ years flag (defaulting to yes), condition and provenance, cost basis in IDR visible to the Owner only, the Draft → Cataloged step, and finding any Item again via search, filters, and the Catalog vs Inventory views.

**Blocked by:** 01 (scaffold, roles, test harness).

**Status:** ready-for-agent

- [ ] An Item can be created in any of the six categories (Furniture, Ceramics & Porcelain, Art & Paintings, Books, Watch, Pen) and the form asks that category's attribute schema including measurement fields
- [ ] Photos upload from an Android browser camera and are stored with auto-derived marketplace-sized variants
- [ ] The 50+ years flag defaults to yes; condition notes and provenance are captured
- [ ] Cost basis in IDR is visible to the Owner only, enforced on the server
- [ ] Incomplete Items rest as Draft; completing the record moves them to Cataloged
- [ ] The Catalog can be searched and filtered by keyword, category, and lifecycle state; Inventory (currently owned) is viewable separately from the full Catalog
- [ ] Seam tests cover Item creation per category template, the role restriction on cost basis, and search/filter behaviour
