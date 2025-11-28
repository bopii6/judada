/**
 * 修复没有挂到单元的关卡。
 *
 * 使用方式：
 *   # 自动将所有未绑定的关卡分配到各课程包的第一个单元
 *   pnpm --filter server tsx src/scripts/fix-lesson-unit-association.ts
 *
 *   # 或者手动指定课程包与目标单元
 *   pnpm --filter server tsx src/scripts/fix-lesson-unit-association.ts <packageId> <unitId>
 */

import { getPrisma } from "../lib/prisma";

const prisma = getPrisma();

const [, , packageIdArg, unitIdArg] = process.argv;

async function reassignLessonsToSpecificUnit(packageId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, packageId, deletedAt: null },
    select: { id: true, title: true, sequence: true }
  });

  if (!unit) {
    console.error(`未找到课程包 ${packageId} 下的单元 ${unitId}`);
    process.exit(1);
  }

  const updatedCount = await prisma.$executeRaw`
    UPDATE "Lesson"
    SET
      "unitId" = ${unit.id},
      "unitNumber" = ${unit.sequence},
      "unitName" = ${unit.title},
      "updatedAt" = NOW()
    WHERE "packageId" = ${packageId}
      AND "deletedAt" IS NULL
      AND "unitId" IS NULL
  `;

  console.log(`✅ 已将 ${updatedCount} 个未分配的关卡绑定到单元「${unit.title}」`);
}

async function autoFixPackagesWithUnits() {
  console.log("开始扫描所有存在单元但关卡未绑定的课程包...\n");
  let totalFixed = 0n;

  const packagesWithUnassociatedLessons = await prisma.$queryRaw`
    SELECT
      cp.id as package_id,
      cp.title as package_title,
      COUNT(DISTINCT u.id) as unit_count,
      COUNT(DISTINCT l.id) as unassociated_lesson_count
    FROM "CoursePackage" cp
    LEFT JOIN "Unit" u ON u."packageId" = cp.id AND u."deletedAt" IS NULL
    LEFT JOIN "Lesson" l ON l."packageId" = cp.id AND l."deletedAt" IS NULL AND l."unitId" IS NULL
    WHERE cp."deletedAt" IS NULL
    GROUP BY cp.id, cp.title
    HAVING COUNT(DISTINCT u.id) > 0 AND COUNT(DISTINCT l.id) > 0
  ` as Array<{
    package_id: string;
    package_title: string;
    unit_count: number;
    unassociated_lesson_count: number;
  }>;

  for (const pkg of packagesWithUnassociatedLessons) {
    console.log(`课程包: ${pkg.package_title}`);
    console.log(`  - 单元数量: ${pkg.unit_count}`);
    console.log(`  - 未绑定单元的关卡数量: ${pkg.unassociated_lesson_count}`);

    const firstUnit = await prisma.$queryRaw`
      SELECT id, sequence, title
      FROM "Unit"
      WHERE "packageId" = ${pkg.package_id} AND "deletedAt" IS NULL
      ORDER BY sequence ASC
      LIMIT 1
    ` as Array<{ id: string; sequence: number; title: string | null }>;

    if (firstUnit.length === 0) {
      console.log("  ⚠️ 该课程包没有单元，跳过\n");
      continue;
    }

    const unit = firstUnit[0];

    const result = await prisma.$executeRaw`
      UPDATE "Lesson"
      SET
        "unitId" = ${unit.id},
        "unitNumber" = ${unit.sequence},
        "unitName" = ${unit.title},
        "updatedAt" = NOW()
      WHERE "packageId" = ${pkg.package_id}
        AND "deletedAt" IS NULL
        AND "unitId" IS NULL
    `;

    console.log(`  ✅ 已将 ${result} 个关卡绑定到单元「${unit.title ?? "未命名单元"}」\n`);
    totalFixed += BigInt(result);
  }

  console.log(`修复完成，共更新 ${totalFixed} 个关卡的单元关联`);
}

async function run() {
  try {
    if (packageIdArg && unitIdArg) {
      await reassignLessonsToSpecificUnit(packageIdArg, unitIdArg);
    } else {
      await autoFixPackagesWithUnits();
    }
    console.log("\n脚本执行完毕");
    process.exit(0);
  } catch (error) {
    console.error("脚本执行失败:", error);
    process.exit(1);
  }
}

void run();
