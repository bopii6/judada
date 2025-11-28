const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const jobs = await prisma.generationJob.findMany({ orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, createdAt: true } });
  console.log(jobs);
  await prisma.$disconnect();
})();
