import { Injectable, Logger } from '@nestjs/common';

interface QueueItem<T> {
  func: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
}

@Injectable()
export class RequestQueueGuard {
  private readonly logger: Logger;
  private queue: QueueItem<any>[] = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
    this.logger = new Logger(RequestQueueGuard.name);
    this.logger.log(`Queue initialized with max concurrency: ${this.maxConcurrent}`);
  }

  /**
   * Processes items from the queue as long as there are available slots.
   */
  private processQueue(): void {
    // Use a while loop to fill all available concurrent slots in one go.
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const item = this.queue.shift()!; // Non-null assertion is safe due to the loop condition.
      this.activeCount++;

      this.logger.debug(`Processing task. Active: ${this.activeCount}, Queue: ${this.queue.length}`);

      item.func()
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.activeCount--;
          this.logger.debug(`Task finished. Active: ${this.activeCount}, Queue: ${this.queue.length}`);
          // A slot has been freed, so try to process the next item in the queue.
          this.processQueue();
        }
      );
    }
  }

  /**
   * Adds a function to the queue. It will be executed when a concurrent slot is available.
   * @param func The async function to execute.
   * @returns A promise that resolves or rejects with the result of the executed function.
   */
  public async enqueue<T>(func: () => Promise<T>): Promise<T> {
    this.logger.debug(`Enqueuing new task. Current queue length: ${this.queue.length}`);
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ func, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Gets the number of items currently waiting in the queue.
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Gets the number of tasks that are currently being executed.
   */
  public getActiveCount(): number {
    return this.activeCount;
  }
}