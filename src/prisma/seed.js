const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const data = [
    { name: "Ada Lovelace", email: "ada@example.com", role: "ADMIN" },
    { name: "Grace Hopper", email: "grace@example.com", role: "MANAGER" },
    { name: "Alan Turing", email: "alan@example.com", role: "USER" }
  ];

  for (const u of data) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: u,
      create: u,
    });
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
