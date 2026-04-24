import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const packages = await prisma.insurancePackage.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log("[check-db] insurancePackage count:", packages.length);
    console.log("[check-db] raw packages:", packages);
  } catch (error) {
    console.error("[check-db] failed to read insurancePackage:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
