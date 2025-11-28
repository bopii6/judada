const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const unitIds = await prisma.unit.findMany({ select: { id: true, title: true, _count: { select: { lessons: { where: { deletedAt: null } } } } } });
  console.log(unitIds);
  const lessons = await prisma.lesson.findMany({ select: { id: true, unitId: true, title: true }, where: { deletedAt: null }, take: 5 });
  console.log(lessons);
  await prisma.$disconnect();
})();
