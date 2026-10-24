"use client";

import { useActionState, useState } from "react";
import {
  recordSocialPost,
  removeSocialPost,
  type ActionState,
} from "@/lib/social/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "../form-error";

// The posting log forms on the item page (ticket 08 + 10). Like the other
// small forms here, each is its own <form> so one pending submit never
// blocks the others.

const initial: ActionState = { error: null };

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function RecordSocialPostForm({
  itemId,
  platforms,
}: {
  itemId: string;
  platforms: string[];
}) {
  const [state, formAction, pending] = useActionState(recordSocialPost, initial);
  const [platform, setPlatform] = useState(platforms[0] ?? "OTHER");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-platform">Posted where</Label>
          <select
            id="post-platform"
            name="platform"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            className={selectClass}
          >
            {/* The Settings-managed list, plus Other — the log records
                wherever the family actually posted, so the list guides
                without gating (ticket 10). */}
            {platforms.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="OTHER">Other…</option>
          </select>
        </div>
        {platform === "OTHER" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="post-platform-other">Which platform?</Label>
            <Input
              id="post-platform-other"
              name="platformOther"
              maxLength={60}
              required
              placeholder="e.g. WhatsApp Status"
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-date">Posted on</Label>
          <Input id="post-date" name="postedOn" type="date" required />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-url">Link to the post (optional)</Label>
          <Input id="post-url" name="url" type="url" placeholder="https://…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-notes">Notes (optional)</Label>
          <Input
            id="post-notes"
            name="notes"
            maxLength={200}
            placeholder="e.g. Story + feed, three photos."
          />
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Log post"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

export function RemoveSocialPostButton({ postId }: { postId: string }) {
  const [state, formAction, pending] = useActionState(removeSocialPost, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="postId" value={postId} />
      <Button
        type="submit"
        variant="destructive"
        size="xs"
        disabled={pending}
        aria-label="Remove this log entry"
      >
        {pending ? "…" : "Remove"}
      </Button>
      {state.error ? <FormError message={state.error} /> : null}
    </form>
  );
}
