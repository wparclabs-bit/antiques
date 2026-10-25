import { getSessionUser } from "@/lib/auth/session";
import { buildListingKit } from "@/lib/export/kit";

// The single-listing kit download behind the item page's Download button.
// Route handlers are the file-serving seam: the zip-building logic lives
// in lib/export/kit.ts where the seam tests cover it.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Sign in first.", { status: 401 });
  }

  const { id } = await params;
  const listingId = new URL(request.url).searchParams.get("listingId");
  if (!listingId) {
    return new Response("Which listing?", { status: 400 });
  }

  const kit = await buildListingKit(id, listingId);
  if (!kit) {
    return new Response("Listing not found.", { status: 404 });
  }

  return new Response(new Uint8Array(kit.bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${kit.filename}"`,
    },
  });
}
