import type { ItemCategory } from "@/generated/prisma/enums";
import { CATEGORY_TEMPLATES, templateFor } from "./categories";

// Validates what the item form sends, against the selected category's
// template. The same rules run no matter who calls the action — the server,
// not the browser, is the source of truth.

export type ItemFormValues = {
  name: string;
  category: ItemCategory;
  fiftyYearsOld: boolean;
  conditionNotes: string | null;
  provenance: string | null;
  attributes: Record<string, string | number>;
};

export type ValidatedItemForm =
  | { ok: true; values: ItemFormValues }
  | { ok: false; fieldErrors: Record<string, string> };

const MAX_TEXT_LENGTH = 500;

export function validateItemForm(formData: FormData): ValidatedItemForm {
  const fieldErrors: Record<string, string> = {};

  const name = String(formData.get("name") ?? "").trim();
  if (!name) fieldErrors.name = "Enter a name.";
  else if (name.length > MAX_TEXT_LENGTH)
    fieldErrors.name = "Keep the name under 500 characters.";

  const category = String(formData.get("category") ?? "");
  if (!CATEGORY_TEMPLATES.some((t) => t.id === category)) {
    fieldErrors.category = "Choose a category.";
  }

  const attributes: Record<string, string | number> = {};
  if (!fieldErrors.category) {
    // Required-ness is NOT checked here: an Item may be saved incomplete and
    // rest as a Draft (spec story 10 — cataloging happens in many sittings).
    // Required fields are enforced when the record moves Draft -> Cataloged
    // (missingForCataloged). What we do reject at creation is bad data:
    // values that are present must be well-formed for their field type.
    for (const field of templateFor(category as ItemCategory).fields) {
      const raw = String(formData.get(`attr.${field.key}`) ?? "").trim();
      if (!raw) continue;

      if (field.type === "number") {
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) {
          fieldErrors[field.key] = `Enter a number greater than zero.`;
          continue;
        }
        attributes[field.key] = value;
      } else if (field.type === "select") {
        if (field.options && !field.options.includes(raw)) {
          fieldErrors[field.key] = `Choose a value from the list.`;
          continue;
        }
        attributes[field.key] = raw;
      } else {
        if (raw.length > MAX_TEXT_LENGTH) {
          fieldErrors[field.key] = `Keep ${field.label} under 500 characters.`;
          continue;
        }
        attributes[field.key] = raw;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  // The 50+ flag defaults to yes (export rules are the safe assumption).
  // The form sends "off" via a hidden input when unchecked — and "off","on"
  // when checked — so only an explicit "off" means younger than 50 years.
  const flagValues = formData.getAll("fiftyYearsOld");
  const fiftyYearsOld =
    flagValues.length === 0 ? true : flagValues.includes("on");

  const conditionNotes = String(formData.get("conditionNotes") ?? "").trim();
  const provenance = String(formData.get("provenance") ?? "").trim();

  return {
    ok: true,
    values: {
      name,
      category: category as ItemCategory,
      fiftyYearsOld,
      conditionNotes: conditionNotes || null,
      provenance: provenance || null,
      attributes,
    },
  };
}

// What a record still needs before it can move from Draft to Cataloged:
// every required template field and at least one photo. Returned as
// human-readable labels so the UI can show the family exactly what is left.
export function missingForCataloged(input: {
  category: ItemCategory;
  attributes: Record<string, string | number>;
  photoCount: number;
}): string[] {
  const missing: string[] = [];

  for (const field of templateFor(input.category).fields) {
    if (field.required && input.attributes[field.key] === undefined) {
      missing.push(field.label + (field.unit ? ` (${field.unit})` : ""));
    }
  }
  if (input.photoCount === 0) {
    missing.push("at least one photo");
  }

  return missing;
}
