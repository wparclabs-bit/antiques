"use client";

// The one-line error paragraph shared by every form on the item pages.
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}
