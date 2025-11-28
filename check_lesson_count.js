const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.lesson.count({ where: { packageVersionId: (await prisma.coursePackage.findFirst({ where: { id: 'fd14b419-efdb-46b1-badd-4abb397610f1' }, select: { currentVersionId: true } })).currentVersionId } });
  console.log('lesson count', count);
  await prisma.$disconnect();
})();
