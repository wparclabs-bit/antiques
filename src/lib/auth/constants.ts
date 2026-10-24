// Shared auth constants. Kept dependency-free so edge-level code (proxy.ts)
// can import them without pulling in the database client.
export const SESSION_COOKIE = "antiques_session";
