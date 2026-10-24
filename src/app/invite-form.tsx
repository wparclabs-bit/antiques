"use client";

import { useActionState } from "react";
import { inviteCataloger, type InviteFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InviteFormState = { error: null, invitedEmail: null };

export function InviteForm() {
  const [state, formAction, pending] = useActionState(
    inviteCataloger,
    initialState
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a Cataloger</CardTitle>
        <CardDescription>
          Create a family account that can add and edit Items, but cannot see
          cost prices or record sales.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-name">Name</Label>
            <Input id="invite-name" name="name" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              autoComplete="off"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-password">Starting password</Label>
            <Input
              id="invite-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              Share the password with them in person — the app sends no email.
            </p>
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.invitedEmail ? (
            <p role="status" className="text-sm text-emerald-600">
              Done — {state.invitedEmail} can sign in now.
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Inviting…" : "Invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
