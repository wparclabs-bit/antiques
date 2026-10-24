// Thrown by Server Actions when the signed-in user may not do the thing.
// Server Actions run on the server, so this rejection holds no matter what
// the UI shows or hides.
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
