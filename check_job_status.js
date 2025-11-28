const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const jobs = await prisma.generationJob.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, unitId: true, status: true, errorMessage: true } });
  console.log(jobs);
  await prisma.$disconnect();
})();
