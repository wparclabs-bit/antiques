"use client";

import { useActionState, useState } from "react";
import {
  createItem,
  updateItem,
  type ItemFormState,
} from "@/lib/catalog/actions";
import {
  CATEGORY_TEMPLATES,
  templateFor,
  type CategoryField,
} from "@/lib/catalog/categories";
import type { ItemCategory } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "./form-error";
import { PhotosInput } from "./photos-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// One form for recording and editing an Item. The category drives which
// template fields appear (src/lib/catalog/categories.ts is the single source
// for both this form and the server-side validation).

export type ItemFormInitialValues = {
  id: string;
  name: string;
  category: ItemCategory;
  fiftyYearsOld: boolean;
  conditionNotes: string | null;
  provenance: string | null;
  attributes: Record<string, string | number>;
};

const initialState: ItemFormState = { error: null, fieldErrors: {} };

function fieldInitial(
  initial: ItemFormInitialValues | undefined,
  key: string
): string | number | undefined {
  const value = initial?.attributes[key];
  return value === undefined ? undefined : String(value);
}

function TemplateField({
  field,
  initial,
  error,
}: {
  field: CategoryField;
  initial?: ItemFormInitialValues;
  error?: string;
}) {
  const id = `attr-${field.key}`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {field.label}
        {field.required ? (
          <span className="text-muted-foreground"> · needed before Cataloged</span>
        ) : null}
        {field.unit ? ` (${field.unit})` : ""}
      </Label>
      {field.type === "select" ? (
        <select
          id={id}
          name={`attr.${field.key}`}
          defaultValue={fieldInitial(initial, field.key) ?? ""}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">—</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            name={`attr.${field.key}`}
            type={field.type === "number" ? "number" : "text"}
            inputMode={field.type === "number" ? "decimal" : undefined}
            min={field.type === "number" ? 0 : undefined}
            step={field.type === "number" ? "any" : undefined}
            placeholder={field.placeholder}
            defaultValue={fieldInitial(initial, field.key) ?? ""}
            aria-invalid={error ? true : undefined}
          />
          {field.unit ? (
            <span className="text-sm text-muted-foreground">{field.unit}</span>
          ) : null}
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}

export function ItemForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: ItemFormInitialValues;
}) {
  const [state, formAction, pending] = useActionState(
    mode === "create" ? createItem : updateItem,
    initialState
  );

  const [category, setCategory] = useState<ItemCategory>(
    initial?.category ?? CATEGORY_TEMPLATES[0].id
  );
  const template = templateFor(category);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {mode === "edit" && initial ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}
      {/* The styled Select is not a native control; sync it into the form. */}
      <input type="hidden" name="category" value={category} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="item-name">Name</Label>
        <Input
          id="item-name"
          name="name"
          required
          maxLength={500}
          placeholder="e.g. Jati Teak Cabinet"
          defaultValue={initial?.name}
          aria-invalid={state.fieldErrors.name ? true : undefined}
        />
        <FormError message={state.fieldErrors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Category</Label>
        <Select
          items={CATEGORY_TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
          value={category}
          onValueChange={(value) => setCategory(value as ItemCategory)}
        >
          <SelectTrigger className="w-full" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The category decides which attributes are asked for below.
        </p>
        <FormError message={state.fieldErrors.category} />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium">
          {template.label} details
        </legend>
        {template.fields.map((field) => (
          <TemplateField
            key={field.key}
            field={field}
            initial={initial}
            error={state.fieldErrors[field.key]}
          />
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        {/* Unchecked, only the hidden "off" is submitted; checked, the
            checkbox adds "on" (see validateItemForm). */}
        <input type="hidden" name="fiftyYearsOld" value="off" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            name="fiftyYearsOld"
            value="on"
            defaultChecked={initial ? initial.fiftyYearsOld : true}
          />
          50+ years old — export rules apply until proven otherwise
        </label>
        <p className="text-xs text-muted-foreground">
          Defaults to yes: items 50+ years old need an SKBCB certificate
          before they may be listed internationally. This can be changed any
          time.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="item-condition">Condition notes</Label>
        <Textarea
          id="item-condition"
          name="conditionNotes"
          rows={3}
          maxLength={2000}
          placeholder="e.g. One door hinge loose, small water ring on top…"
          defaultValue={initial?.conditionNotes ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="item-provenance">Provenance</Label>
        <Textarea
          id="item-provenance"
          name="provenance"
          rows={3}
          maxLength={2000}
          placeholder="Where this piece came from — the story behind it."
          defaultValue={initial?.provenance ?? ""}
        />
      </div>

      {mode === "create" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="item-photos">Photos</Label>
          <PhotosInput id="item-photos" invalid={Boolean(state.fieldErrors.photos)} />
          <p className="text-xs text-muted-foreground">
            Use the phone camera or gallery — up to 6 photos per save; they
            are resized automatically. More can be added later on the item
            page.
          </p>
          <FormError message={state.fieldErrors.photos} />
        </div>
      ) : null}

      <FormError message={state.error} />

      <Button type="submit" disabled={pending} className="self-start">
        {pending
          ? "Saving…"
          : mode === "create"
            ? "Save as Draft"
            : "Save changes"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Records save as <strong>Draft</strong> — even with gaps. You finish
        them on the item page, where &ldquo;Mark as Cataloged&rdquo; checks
        that everything needed is present.
      </p>
    </form>
  );
}
