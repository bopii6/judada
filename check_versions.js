const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const versions = await prisma.coursePackageVersion.findMany({ where: { packageId: 'fd14b419-efdb-46b1-badd-4abb397610f1' }, select: { id: true, versionNumber: true, status: true } });
  console.log(versions);
  await prisma.$disconnect();
})();
