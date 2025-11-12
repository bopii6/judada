import { createQueue } from "../lib/queue";

export const PACKAGE_GENERATION_QUEUE = "package-generation";

export type PackageGenerationJobName = "generate";

export interface PackageGenerationJobData {
  generationJobId: string;
}

export const packageGenerationQueue = createQueue<PackageGenerationJobData, void, PackageGenerationJobName>(
  PACKAGE_GENERATION_QUEUE,
  {
    removeOnComplete: 500,
    removeOnFail: 5000
  }
);

export const enqueuePackageGenerationJob = async (generationJobId: string) => {
  await packageGenerationQueue.add("generate", { generationJobId }, { jobId: generationJobId });
};
