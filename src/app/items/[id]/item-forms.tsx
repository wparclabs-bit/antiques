"use client";

import { useActionState } from "react";
import {
  addPhotos,
  catalogItem,
  removePhoto,
  setCostBasis,
  type ActionState,
} from "@/lib/catalog/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "../form-error";
import { PhotosInput } from "../photos-input";

// The small action forms on the item page. Each is its own <form> so one
// pending submit never blocks the others.

const initial: ActionState = { error: null };

function Error({ state }: { state: ActionState }) {
  return <FormError message={state.error} />;
}

export function AddPhotosForm({ itemId }: { itemId: string }) {
  const [state, formAction, pending] = useActionState(addPhotos, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <Label htmlFor="add-photos">Add photos</Label>
      <PhotosInput id="add-photos" />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      <Error state={state} />
    </form>
  );
}

export function RemovePhotoButton({ photoId }: { photoId: string }) {
  const [state, formAction, pending] = useActionState(removePhoto, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="photoId" value={photoId} />
      <Button
        type="submit"
        variant="destructive"
        size="xs"
        disabled={pending}
        aria-label="Remove this photo"
      >
        {pending ? "…" : "Remove"}
      </Button>
      {state.error ? <Error state={state} /> : null}
    </form>
  );
}

export function CostBasisForm({
  itemId,
  costBasisIdr,
}: {
  itemId: string;
  costBasisIdr: number | null;
}) {
  const [state, formAction, pending] = useActionState(setCostBasis, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <Label htmlFor="cost-basis">
        Cost basis (IDR) — only the Owner can see or set this
      </Label>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <Input
            id="cost-basis"
            name="costBasisIdr"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 3500000"
            defaultValue={costBasisIdr ?? ""}
            aria-invalid={state.error ? true : undefined}
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        What this piece cost us (0 for inherited items). Leave empty to clear.
      </p>
      <Error state={state} />
    </form>
  );
}

export function CatalogButton({ itemId }: { itemId: string }) {
  const [state, formAction, pending] = useActionState(catalogItem, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Mark as Cataloged"}
      </Button>
      <Error state={state} />
    </form>
  );
}
