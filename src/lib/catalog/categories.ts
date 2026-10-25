import type { ItemCategory } from "@/generated/prisma/enums";

// The attribute schema each category's Items carry (spec: "category
// templates"). The same definitions drive the entry form, the server-side
// validation, and the item detail page, so the three can never drift apart.
//
// Field types:
//   text   — free text, trimmed before storing
//   number — positive number (measurements and counts)
//   select — one of a fixed set of options
//
// Fields flagged `measurement` are the manual measurements per category
// template; the shipping ticket will read them for its estimates.

export type CategoryField = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  required?: boolean;
  unit?: string;
  options?: string[];
  placeholder?: string;
  measurement?: boolean;
  // Fields that help a marketplace search find similar sold items — the
  // sold-search links (src/lib/valuation/search-links.ts) fold them into
  // the query after the item's name.
  identifying?: boolean;
};

export type CategoryTemplate = {
  id: ItemCategory;
  label: string;
  fields: CategoryField[];
};

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    id: "FURNITURE",
    label: "Furniture",
    fields: [
      { key: "material", label: "Wood / material", type: "text", required: true, identifying: true, placeholder: "e.g. Teak, Mahogany" },
      { key: "style", label: "Style", type: "text", identifying: true, placeholder: "e.g. Colonial, Art Deco" },
      { key: "period", label: "Period", type: "text", identifying: true, placeholder: "e.g. Early 20th century" },
      { key: "heightCm", label: "Height", type: "number", required: true, unit: "cm", measurement: true },
      { key: "widthCm", label: "Width", type: "number", required: true, unit: "cm", measurement: true },
      { key: "depthCm", label: "Depth", type: "number", required: true, unit: "cm", measurement: true },
      { key: "weightKg", label: "Weight", type: "number", unit: "kg", measurement: true },
    ],
  },
  {
    id: "CERAMICS_PORCELAIN",
    label: "Ceramics & Porcelain",
    fields: [
      { key: "makersMark", label: "Maker's mark", type: "text", identifying: true, placeholder: "Mark on the base, if any" },
      { key: "technique", label: "Technique", type: "text", identifying: true, placeholder: "e.g. Blue & white, Famille Rose" },
      { key: "period", label: "Period", type: "text", placeholder: "e.g. Qing dynasty, 19th century" },
      { key: "origin", label: "Origin", type: "text", identifying: true, placeholder: "e.g. Jingdezhen, Delft" },
      { key: "heightCm", label: "Height", type: "number", required: true, unit: "cm", measurement: true },
      { key: "diameterCm", label: "Diameter", type: "number", required: true, unit: "cm", measurement: true },
      { key: "weightKg", label: "Weight", type: "number", unit: "kg", measurement: true },
    ],
  },
  {
    id: "ART_PAINTINGS",
    label: "Art & Paintings",
    fields: [
      { key: "artist", label: "Artist", type: "text", required: true, identifying: true, placeholder: "e.g. Raden Saleh, Unknown" },
      { key: "medium", label: "Medium", type: "text", required: true, placeholder: "e.g. Oil on canvas" },
      { key: "subject", label: "Subject", type: "text", identifying: true },
      { key: "signature", label: "Signature", type: "text", placeholder: "e.g. Signed lower right" },
      {
        key: "framed",
        label: "Framing",
        type: "select",
        options: ["Framed", "Unframed"],
      },
      { key: "imageHeightCm", label: "Image height", type: "number", required: true, unit: "cm", measurement: true },
      { key: "imageWidthCm", label: "Image width", type: "number", required: true, unit: "cm", measurement: true },
      { key: "frameHeightCm", label: "Frame height", type: "number", unit: "cm", measurement: true },
      { key: "frameWidthCm", label: "Frame width", type: "number", unit: "cm", measurement: true },
    ],
  },
  {
    id: "BOOKS",
    label: "Books",
    fields: [
      { key: "author", label: "Author", type: "text", required: true, identifying: true },
      { key: "publisher", label: "Publisher", type: "text", identifying: true },
      { key: "yearPublished", label: "Year published", type: "text", placeholder: "e.g. 1923" },
      { key: "edition", label: "Edition", type: "text", identifying: true, placeholder: "e.g. First edition" },
      { key: "language", label: "Language", type: "text" },
      { key: "pageCount", label: "Pages", type: "number" },
      { key: "heightCm", label: "Height", type: "number", required: true, unit: "cm", measurement: true },
      { key: "widthCm", label: "Width", type: "number", required: true, unit: "cm", measurement: true },
      { key: "thicknessCm", label: "Thickness", type: "number", unit: "cm", measurement: true },
      { key: "weightKg", label: "Weight", type: "number", unit: "kg", measurement: true },
    ],
  },
  {
    id: "WATCH",
    label: "Watch",
    fields: [
      { key: "brand", label: "Brand", type: "text", required: true, identifying: true, placeholder: "e.g. Omega, Seiko" },
      { key: "model", label: "Model", type: "text", identifying: true },
      {
        key: "movement",
        label: "Movement",
        type: "select",
        required: true,
        options: ["Manual winding", "Automatic", "Quartz"],
      },
      { key: "caseMaterial", label: "Case material", type: "text", required: true, placeholder: "e.g. Stainless steel, 18k gold" },
      { key: "caseDiameterMm", label: "Case diameter", type: "number", unit: "mm", measurement: true },
      { key: "period", label: "Year / period", type: "text", identifying: true, placeholder: "e.g. 1960s" },
      { key: "serialNumber", label: "Serial number", type: "text" },
    ],
  },
  {
    id: "PEN",
    label: "Pen",
    fields: [
      { key: "brand", label: "Brand", type: "text", required: true, placeholder: "e.g. Montblanc, Parker" },
      { key: "model", label: "Model", type: "text", identifying: true },
      { key: "material", label: "Material", type: "text", placeholder: "e.g. Black lacquer, celluloid" },
      { key: "nib", label: "Nib", type: "text", placeholder: "e.g. 14k gold, fine" },
      {
        key: "fillingMechanism",
        label: "Filling mechanism",
        type: "select",
        options: ["Piston", "Cartridge / converter", "Eyedropper", "Lever filler", "Other"],
      },
      { key: "lengthCm", label: "Length (capped)", type: "number", unit: "cm", measurement: true },
      { key: "weightG", label: "Weight", type: "number", unit: "g", measurement: true },
    ],
  },
  {
    // Clothing, bags, and textiles among the heirlooms — added at the
    // Owner's request (2026-10-25) with the same single-source pattern.
    id: "FASHION",
    label: "Fashion",
    fields: [
      { key: "garment", label: "Type of piece", type: "text", required: true, identifying: true, placeholder: "e.g. Kebaya, Evening dress, Handbag, Batik cloth" },
      { key: "material", label: "Material", type: "text", identifying: true, placeholder: "e.g. Silk, Ikat cotton, Leather" },
      { key: "designer", label: "Designer / brand", type: "text", identifying: true, placeholder: "e.g. Iwan Tirta, Hermès, None (hand-sewn)" },
      { key: "size", label: "Size", type: "text", placeholder: "e.g. M, 38, fits 90 cm bust" },
      { key: "period", label: "Period / era", type: "text", identifying: true, placeholder: "e.g. 1960s" },
      { key: "lengthCm", label: "Length", type: "number", required: true, unit: "cm", measurement: true },
      { key: "widthCm", label: "Width", type: "number", required: true, unit: "cm", measurement: true },
      { key: "depthCm", label: "Depth (folded / bags)", type: "number", unit: "cm", measurement: true },
      { key: "weightKg", label: "Weight", type: "number", unit: "kg", measurement: true },
    ],
  },
  {
    // Anything outside the main categories: a free-form record of what
    // the piece is, plus the general attributes every antique shares.
    id: "OTHER",
    label: "Other",
    fields: [
      { key: "object", label: "What is it?", type: "text", required: true, identifying: true, placeholder: "e.g. Wayang kulit puppet, brass scale" },
      { key: "material", label: "Material", type: "text", placeholder: "e.g. Brass, wood, textile" },
      { key: "period", label: "Period", type: "text", placeholder: "e.g. 19th century" },
      { key: "origin", label: "Place of origin", type: "text", placeholder: "e.g. Yogyakarta, China" },
      { key: "heightCm", label: "Height", type: "number", unit: "cm", measurement: true },
      { key: "widthCm", label: "Width", type: "number", unit: "cm", measurement: true },
      { key: "depthCm", label: "Depth", type: "number", unit: "cm", measurement: true },
      { key: "weightKg", label: "Weight", type: "number", unit: "kg", measurement: true },
    ],
  },
];

export function templateFor(category: ItemCategory): CategoryTemplate {
  const template = CATEGORY_TEMPLATES.find((t) => t.id === category);
  if (!template) {
    throw new Error(`No template for category ${category}`);
  }
  return template;
}
