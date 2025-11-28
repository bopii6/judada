const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const logs = await prisma.jobLog.findMany({ where: { jobId: '1958d364-1059-4f05-9e02-3f8202dbbbfc' }, select: { level: true, message: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
  console.dir(logs, { depth: null });
  await prisma.$disconnect();
})();
