// Shared stand-ins for Next.js runtime transport in tests. There is no HTTP
// request and no browser in a test process, so the cookie jar and page
// redirects are replaced with in-memory versions. Everything else — the
// Server Actions under test, the database — is real.
//
// Each suite that needs it does:
//   vi.mock("next/headers", async () => (await import("@/test/browser-transport")).nextHeaders)
// and imports { cookieStore } to act as the browser.

// The "browser": session cookie -> session token value.
export const cookieStore = new Map<string, string>();

export const nextHeaders = {
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
    set: (arg: { name: string; value: string } | string, value?: string) => {
      if (typeof arg === "string") cookieStore.set(arg, value ?? "");
      else cookieStore.set(arg.name, arg.value);
    },
    delete: (name: string) => cookieStore.delete(name),
  }),
};

export const nextNavigation = {
  // next/navigation's redirect() never returns; tests observe it as an error.
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
  },
};

export const nextCache = {
  revalidatePath: () => {},
};

export const nextServer = {
  // Declared-dynamic boundary used by session.ts; no-op in tests.
  connection: async () => {},
};
