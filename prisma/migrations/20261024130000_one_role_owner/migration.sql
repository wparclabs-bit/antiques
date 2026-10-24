-- ADR-0003: one role — every account is an Owner. The migration drops the
-- Role enum and User.role; no promotion step is needed because the app no
-- longer reads the column (signed-in == Owner). Dropping is safe for every
-- existing account: the gate that distinguished them is gone with the column.
DROP INDEX IF EXISTS "User_role_idx";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_role_fks";
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";
DROP TYPE IF EXISTS "Role";
