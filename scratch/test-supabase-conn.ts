import { PrismaClient } from "@prisma/client";

async function testConnection() {
  const dbUrl = "postgresql://postgres.qnmlgjxxsywyiqnktfas:Supabase%40333@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const directUrl = "postgresql://postgres.qnmlgjxxsywyiqnktfas:Supabase%40333@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
  
  console.log("Testing Supabase connectivity...");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: directUrl,
      },
    },
  });

  try {
    const res = await prisma.$queryRaw`SELECT 1 as test`;
    console.log("Supabase direct connection successful:", res);
  } catch (err) {
    console.error("Supabase direct connection failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
