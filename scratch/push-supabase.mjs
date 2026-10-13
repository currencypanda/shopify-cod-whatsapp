import { execSync } from "node:child_process";

// URL encode @ in password Supabase@333 -> Supabase%40333
const databaseUrl = "postgresql://postgres.qnmlgjxxsywyiqnktfas:Supabase%40333@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const directUrl = "postgresql://postgres.qnmlgjxxsywyiqnktfas:Supabase%40333@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";

console.log("Starting Prisma db push to Supabase...");

try {
  const output = execSync("npx.cmd prisma db push --schema=prisma/schema.postgresql.prisma", {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: directUrl,
    },
    encoding: "utf-8",
    stdio: "pipe",
  });
  console.log("SUCCESS:\n", output);
} catch (error) {
  console.error("ERROR pushing to Supabase:\n", error.stdout || error.message);
  if (error.stderr) console.error("STDERR:\n", error.stderr);
  process.exit(1);
}
