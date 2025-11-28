const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const logs = await prisma.jobLog.findMany({ where: { jobId: '93739a27-3e4a-47d9-8a80-e635a3793e03' }, orderBy: { createdAt: 'asc' }, select: { message: true } });
  console.log(logs.map(l => l.message));
  await prisma.$disconnect();
})();
