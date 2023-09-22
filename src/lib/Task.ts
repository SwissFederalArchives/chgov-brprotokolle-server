import logger from "./Logger.js";
import { workersRunning, libsRunning } from "./Service.js";
import { getPersistentClient } from "./Redis.js";

const MAX_PARALLEL_TASKS = 5;
const currentTasks: { [type: string]: number } = {};
const taskQueues: { [type: string]: Array<() => Promise<void>> } = {};

function executeWhenPossible(type: string, func: () => Promise<void>) {
  if (!currentTasks[type]) {
    currentTasks[type] = 0;
  }
  if (!taskQueues[type]) {
    taskQueues[type] = [];
  }

  if (currentTasks[type] < MAX_PARALLEL_TASKS) {
    currentTasks[type]++;
    func().finally(() => {
      currentTasks[type]--;
      if (taskQueues[type].length > 0) {
        const nextTask = taskQueues[type].shift();
        if (nextTask) {
          executeWhenPossible(type, nextTask);
        }
      }
    });
  } else {
    taskQueues[type].push(func);
  }
}

export function runTask<T>(type: string, task: T): Promise<void> {
  return new Promise((resolve, reject) => {
    executeWhenPossible(type, async () => {
      try {
        if (type in workersRunning) {
          const service = workersRunning[type];
          const loadedService = await service.loadService();
          await loadedService(task);
          resolve();
        } else {
          const client = getPersistentClient();
          if (!client) {
            throw new Error(
              "A persistent Redis server is required for sending tasks to workers!"
            );
          }
          logger.debug(`Sending a new task with type '${type}'`);
          await client.rPush(`tasks:${type}`, JSON.stringify(task));
          resolve();
        }
      } catch (err) {
        logger.error(`Failure during task with type '${type}'`, { err });
        reject(err);
      }
    });
  });
}

export async function runLib<P, R>(type: string, params: P): Promise<R> {
  if (!(type in libsRunning)) throw new Error(`No lib found of type '${type}'`);

  const service = await libsRunning[type].loadService();
  return service(params);
}
