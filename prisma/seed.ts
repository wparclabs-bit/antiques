import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

// Creates the first Owner account. There is no public signup, so this seed
// is the only way an Owner comes into existence. It is idempotent: if the
// account already exists, nothing is changed (passwords are never overwritten).
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env first (see README.md)."
    );
  }
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password) {
    throw new Error(
      "SEED_OWNER_PASSWORD is not set. Set it in .env (or the environment) — it becomes the Owner's sign-in password."
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const email = (
    process.env.SEED_OWNER_EMAIL ?? "owner@antiques.local"
  ).toLowerCase();
  const name = process.env.SEED_OWNER_NAME ?? "Owner";

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      passwordHash: await hashPassword(password),
      role: "OWNER",
    },
  });

  console.log(`Owner ready: ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
