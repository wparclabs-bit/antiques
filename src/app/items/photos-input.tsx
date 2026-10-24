"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { downscaleImages } from "./resize-photos";

// The file input used by both photo forms. On selection it immediately
// downscales the chosen images in the browser (see resize-photos.ts) and
// swaps them into the input, so the form submits sane-size JPEGs no matter
// what the camera produced.
export function PhotosInput({
  id,
  invalid,
}: {
  id: string;
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  async function handleChange() {
    const input = inputRef.current;
    if (!input || !input.files || input.files.length === 0) return;

    setPreparing(true);
    try {
      const resized = await downscaleImages([...input.files]);
      const transfer = new DataTransfer();
      for (const file of resized) transfer.items.add(file);
      input.files = transfer.files;
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        ref={inputRef}
        id={id}
        name="photos"
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        aria-invalid={invalid ? true : undefined}
      />
      {preparing ? (
        <p className="text-xs text-muted-foreground">Resizing photos…</p>
      ) : null}
    </div>
  );
}
