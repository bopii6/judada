import { Queue, QueueEvents, Worker, Processor, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { getEnv } from "../config/env";

const { REDIS_URL, QUEUE_PREFIX } = getEnv();

const sharedConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

export const createQueue = <JobData = unknown, JobResult = unknown, JobName extends string = string>(
  name: string,
  defaultJobOptions?: JobsOptions
) =>
  new Queue<JobData, JobResult, JobName>(name, {
    connection: sharedConnection,
    prefix: QUEUE_PREFIX,
    defaultJobOptions
  });

export const createQueueEvents = (name: string) =>
  new QueueEvents(name, {
    connection: sharedConnection,
    prefix: QUEUE_PREFIX
  });

export const createWorker = <T = unknown, R = unknown>(
  name: string,
  processor: Processor<T, R, string>
) =>
  new Worker<T, R, string>(name, processor, {
    connection: sharedConnection,
    prefix: QUEUE_PREFIX
  });
