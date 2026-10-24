import { getSocialPosts } from "@/lib/social/actions";
import { formatDate } from "@/lib/catalog/display";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecordSocialPostForm, RemoveSocialPostButton } from "./social-forms";

// The Posting Log (ticket 08): where and when each Item was posted, so
// the family's marketing effort is visible and never repeated by
// accident. The drafts to copy live on each listing above; this card is
// the record of what actually went out. Owner-only — getSocialPosts
// returns null for anyone else and the card is not rendered.
export async function SocialCard({ itemId }: { itemId: string }) {
  const entries = await getSocialPosts(itemId);
  if (!entries) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Posting log</CardTitle>
        <CardDescription>
          Where and when this item was posted — marketing effort stays
          visible and nothing goes out twice by accident.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing posted yet — log the first post below.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">
                    {entry.platform}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {formatDate(entry.postedOn)}
                    </span>
                  </span>
                  {entry.notes ? (
                    <span className="text-xs text-muted-foreground">
                      {entry.notes}
                    </span>
                  ) : null}
                  {entry.url ? (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {entry.url}
                    </a>
                  ) : null}
                </div>
                <RemoveSocialPostButton postId={entry.id} />
              </li>
            ))}
          </ul>
        )}
        <RecordSocialPostForm itemId={itemId} />
      </CardContent>
    </Card>
  );
}
