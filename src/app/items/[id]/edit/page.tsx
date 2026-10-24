import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getItem } from "@/lib/catalog/actions";
import { ItemForm } from "../../item-form";

// The page reads the session cookie, so it must render per request.
export const instant = false;

export default async function EditItemPage({
  params,
}: PageProps<"/items/[id]/edit">) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const item = await getItem(id);
  if (!item) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header>
        <Link
          href={`/items/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {item.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit Item
        </h1>
        <p className="text-sm text-muted-foreground">
          Attributes follow the category template. Photos are managed on the
          item page.
        </p>
      </header>
      <ItemForm
        mode="edit"
        initial={{
          id: item.id,
          name: item.name,
          category: item.category,
          fiftyYearsOld: item.fiftyYearsOld,
          conditionNotes: item.conditionNotes,
          provenance: item.provenance,
          attributes: item.attributes,
        }}
      />
    </main>
  );
}
