import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./vitest.shared";

// The test database must have the same schema as the dev database.
// `prisma migrate deploy` applies the committed migrations; it is safe to
// re-run and does not create a shadow database like `migrate dev` does.
export default function globalSetup() {
  try {
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "inherit",
    });
  } catch {
    console.error(
      "\nCould not apply migrations to the test database.\n" +
        "Is PostgreSQL running? Start it with: docker compose up -d\n" +
        `Test database URL: ${TEST_DATABASE_URL}\n`
    );
    process.exit(1);
  }
}
