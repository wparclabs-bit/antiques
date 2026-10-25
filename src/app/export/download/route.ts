import { getSessionUser } from "@/lib/auth/session";
import { buildCategoryKit } from "@/lib/export/kit";
import { isKnownCategory } from "@/lib/catalog/display";

// The category × marketplace bundle download behind the Export page.
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Sign in first.", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const category = params.get("category") ?? "";
  const marketplaceId = params.get("marketplaceId") ?? "";
  if (!isKnownCategory(category) || !marketplaceId) {
    return new Response("Pick a category and a marketplace.", { status: 400 });
  }

  const kit = await buildCategoryKit(category, marketplaceId);
  if (!kit) {
    return new Response("Marketplace not found.", { status: 404 });
  }

  return new Response(new Uint8Array(kit.bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${kit.filename}"`,
    },
  });
}
