import { JobLogLevel, JobStatus, JobType, Prisma, SourceType } from "@prisma/client";

import { getPrisma } from "../lib/prisma";

const prisma = getPrisma();

export interface CreateGenerationJobInput {
  jobType: JobType;
  packageId?: string | null;
  packageVersionId?: string | null;
  unitId?: string | null;
  triggeredById?: string | null;
  sourceType?: SourceType | null;
  inputInfo?: Prisma.InputJsonValue | null;
}

export const generationJobRepository = {
  /**
   * 创建生成任务，默认状态为 queued。
   */
  create: (input: CreateGenerationJobInput) =>
    prisma.generationJob.create({
      data: {
        jobType: input.jobType,
        status: "queued",
        packageId: input.packageId ?? null,
        packageVersionId: input.packageVersionId ?? null,
        unitId: input.unitId ?? null,
        triggeredById: input.triggeredById ?? null,
        sourceType: input.sourceType ?? null,
        inputInfo: input.inputInfo ?? undefined
      }
    }),

  findById: (id: string) =>
    prisma.generationJob.findUnique({
      where: { id }
    }),
  findDetailById: (id: string) =>
    prisma.generationJob.findUnique({
      where: { id },
      include: {
        package: {
          select: {
            id: true,
            title: true
          }
        },
        packageVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true
          }
        }
      }
    }),

  /**
   * 更新任务状态与进度。
   */
  updateStatus: (
    id: string,
    update: {
      status: JobStatus;
      progress?: number | null;
      result?: Prisma.InputJsonValue | null;
      errorMessage?: string | null;
      completedAt?: Date | null;
      startedAt?: Date | null;
    }
  ) =>
    prisma.generationJob.update({
      where: { id },
      data: {
        status: update.status,
        progress: update.progress ?? undefined,
        result: update.result ?? undefined,
        errorMessage: update.errorMessage ?? null,
        startedAt: update.startedAt ?? undefined,
        completedAt:
          update.completedAt ??
          (update.status === "succeeded" || update.status === "failed" || update.status === "canceled" ? new Date() : null)
      }
    }),

  /**
   * 最近的生成任务列表。
   */
  listRecent: (limit = 20) =>
    prisma.generationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        package: {
          select: {
            id: true,
            title: true
          }
        },
        packageVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true
          }
        }
      }
    }),

  /**
   * 记录任务日志。
   */
  appendLog: (jobId: string, message: string, level: JobLogLevel = "info", details?: Prisma.InputJsonValue | null) =>
    prisma.jobLog.create({
      data: {
        jobId,
        level,
        message,
        details: details ?? undefined
      }
    })
};
