import { RequestQueueGuard } from '../../../src/common/guards/llm/request-queue.guard';
import { RequestQueueConfig } from '../../../src/common/types/llm/client.types';

describe('RequestQueueGuard', () => {
  let queue: RequestQueueGuard;
  let defaultConfig: RequestQueueConfig;

  beforeEach(() => {
    defaultConfig = {
      maxConcurrent: 3,
    };
    queue = new RequestQueueGuard(defaultConfig);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(queue).toBeDefined();
      expect(queue.getActiveCount()).toBe(0);
      expect(queue.getQueueLength()).toBe(0);
      expect((queue as any).maxConcurrent).toBe(3);
    });

    it('should initialize with different maxConcurrent values', () => {
      const customConfig: RequestQueueConfig = {
        maxConcurrent: 10,
      };
      const customQueue = new RequestQueueGuard(customConfig);
      expect((customQueue as any).maxConcurrent).toBe(10);
    });
  });

  describe('enqueue', () => {
    it('should execute a single task immediately', async () => {
      const mockTask = jest.fn().mockResolvedValue('result');
      
      const result = await queue.enqueue(mockTask);
      
      expect(result).toBe('result');
      expect(mockTask).toHaveBeenCalledTimes(1);
      expect(queue.getActiveCount()).toBe(0);
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should execute multiple tasks concurrently up to maxConcurrent', async () => {
      let resolveTask1: () => void;
      let resolveTask2: () => void;
      let resolveTask3: () => void;
      
      const task1 = jest.fn(() => new Promise<string>(resolve => {
        resolveTask1 = () => resolve('task1');
      }));
      const task2 = jest.fn(() => new Promise<string>(resolve => {
        resolveTask2 = () => resolve('task2');
      }));
      const task3 = jest.fn(() => new Promise<string>(resolve => {
        resolveTask3 = () => resolve('task3');
      }));
      
      const promise1 = queue.enqueue(task1);
      const promise2 = queue.enqueue(task2);
      const promise3 = queue.enqueue(task3);
      
      // Wait for tasks to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(queue.getActiveCount()).toBe(3);
      expect(queue.getQueueLength()).toBe(0);
      
      resolveTask1!();
      resolveTask2!();
      resolveTask3!();
      
      await Promise.all([promise1, promise2, promise3]);
      
      expect(queue.getActiveCount()).toBe(0);
    });

    it('should queue tasks when maxConcurrent is reached', async () => {
      let resolveTask1: () => void;
      let resolveTask2: () => void;
      let resolveTask3: () => void;
      
      const task1 = jest.fn(() => new Promise<string>(resolve => {
        resolveTask1 = () => resolve('task1');
      }));
      const task2 = jest.fn(() => new Promise<string>(resolve => {
        resolveTask2 = () => resolve('task2');
      }));
      const task3 = jest.fn(() => new Promise<string>(resolve => {
        resolveTask3 = () => resolve('task3');
      }));
      const task4 = jest.fn().mockResolvedValue('task4');
      const task5 = jest.fn().mockResolvedValue('task5');
      
      queue.enqueue(task1);
      queue.enqueue(task2);
      queue.enqueue(task3);
      queue.enqueue(task4);
      queue.enqueue(task5);
      
      // Wait for tasks to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(queue.getActiveCount()).toBe(3);
      expect(queue.getQueueLength()).toBe(2);
      
      resolveTask1!();
      resolveTask2!();
      resolveTask3!();
      
      // Wait for queued tasks to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(queue.getActiveCount()).toBe(0);
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should process tasks in FIFO order', async () => {
      const results: number[] = [];
      const resolvers: Array<() => void> = [];
      
      // Create tasks that wait for manual resolution
      const createControlledTask = (id: number) => () => 
        new Promise<number>(resolve => {
          resolvers[id - 1] = () => {
            results.push(id);
            resolve(id);
          };
        });
      
      // Enqueue 5 tasks
      const promises = [
        queue.enqueue(createControlledTask(1)),
        queue.enqueue(createControlledTask(2)),
        queue.enqueue(createControlledTask(3)),
        queue.enqueue(createControlledTask(4)),
        queue.enqueue(createControlledTask(5)),
      ];
      
      // Wait for first 3 tasks to start (filling maxConcurrent slots)
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify first 3 are active, last 2 are queued
      expect(queue.getActiveCount()).toBe(3);
      expect(queue.getQueueLength()).toBe(2);
      
      // Complete tasks in order: 1, 2, 3
      resolvers[0](); // Completes task1, starts task4
      await new Promise(resolve => setTimeout(resolve, 10));
      
      resolvers[1](); // Completes task2, starts task5
      await new Promise(resolve => setTimeout(resolve, 10));
      
      resolvers[2](); // Completes task3
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Complete remaining tasks: 4, 5
      resolvers[3]();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      resolvers[4]();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await Promise.all(promises);
      
      // Tasks should complete in the order they were resolved
      expect(results).toEqual([1, 2, 3, 4, 5]);
    }, 10000);

    it('should handle task failures correctly', async () => {
      const error = new Error('Task failed');
      const failingTask = jest.fn().mockRejectedValue(error);
      
      await expect(queue.enqueue(failingTask)).rejects.toThrow('Task failed');
      
      expect(queue.getActiveCount()).toBe(0);
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should continue processing queue after task failure', async () => {
      const error = new Error('Task failed');
      const failingTask = jest.fn().mockRejectedValue(error);
      const successTask = jest.fn().mockResolvedValue('success');
      
      const promise1 = queue.enqueue(failingTask).catch(e => e);
      const promise2 = queue.enqueue(successTask);
      
      await Promise.all([promise1, promise2]);
      
      expect(queue.getActiveCount()).toBe(0);
      expect(queue.getQueueLength()).toBe(0);
      expect(successTask).toHaveBeenCalled();
    });

    it('should handle many concurrent tasks', async () => {
      const taskCount = 50;
      const tasks = Array.from({ length: taskCount }, (_, i) => 
        () => Promise.resolve(i)
      );
      
      const promises = tasks.map(task => queue.enqueue(task));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(taskCount);
      expect(results).toEqual(Array.from({ length: taskCount }, (_, i) => i));
    }, 10000);
  });

  describe('getQueueLength', () => {
    it('should return 0 when queue is empty', () => {
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should return correct queue length', async () => {
      let resolveTask: () => void;
      const longTask = () => new Promise<void>(resolve => {
        resolveTask = resolve;
      });
      
      // Fill up concurrent slots
      queue.enqueue(longTask);
      queue.enqueue(longTask);
      queue.enqueue(longTask);
      
      // These should be queued
      queue.enqueue(() => Promise.resolve());
      queue.enqueue(() => Promise.resolve());
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(queue.getQueueLength()).toBe(2);
      
      resolveTask!();
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 when no tasks are active', () => {
      expect(queue.getActiveCount()).toBe(0);
    });

    it('should return correct active count', async () => {
      let resolveTask1: () => void;
      let resolveTask2: () => void;
      
      const task1 = () => new Promise<void>(resolve => {
        resolveTask1 = resolve;
      });
      const task2 = () => new Promise<void>(resolve => {
        resolveTask2 = resolve;
      });
      
      queue.enqueue(task1);
      queue.enqueue(task2);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(queue.getActiveCount()).toBe(2);
      
      resolveTask1!();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(queue.getActiveCount()).toBe(1);
      
      resolveTask2!();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(queue.getActiveCount()).toBe(0);
    });

    it('should not exceed maxConcurrent', async () => {
      const resolvers: (() => void)[] = [];
      
      const createTask = () => () => new Promise<void>(resolve => {
        resolvers.push(resolve);
      });
      
      // Enqueue more tasks than maxConcurrent
      for (let i = 0; i < 10; i++) {
        queue.enqueue(createTask());
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(queue.getActiveCount()).toBeLessThanOrEqual(3);
      
      // Clean up
      resolvers.forEach(resolve => resolve());
    });
  });

  describe('edge cases', () => {
    it('should handle tasks that complete synchronously', async () => {
      const syncTask = jest.fn(() => Promise.resolve('sync'));
      
      const result = await queue.enqueue(syncTask);
      
      expect(result).toBe('sync');
      expect(syncTask).toHaveBeenCalledTimes(1);
    });

    it('should handle tasks with different execution times', async () => {
      const fastTask = () => new Promise(resolve => 
        setTimeout(() => resolve('fast'), 10)
      );
      const slowTask = () => new Promise(resolve => 
        setTimeout(() => resolve('slow'), 100)
      );
      
      const promise1 = queue.enqueue(slowTask);
      const promise2 = queue.enqueue(fastTask);
      
      const results = await Promise.all([promise1, promise2]);
      
      expect(results).toContain('fast');
      expect(results).toContain('slow');
    }, 5000);

    it('should handle maxConcurrent of 1 (sequential execution)', async () => {
      const sequentialConfig: RequestQueueConfig = {
        maxConcurrent: 1,
      };
      const sequentialQueue = new RequestQueueGuard(sequentialConfig);
      
      const executionOrder: number[] = [];
      
      const createTask = (id: number) => () => {
        executionOrder.push(id);
        return new Promise(resolve => setTimeout(() => resolve(id), 10));
      };
      
      await Promise.all([
        sequentialQueue.enqueue(createTask(1)),
        sequentialQueue.enqueue(createTask(2)),
        sequentialQueue.enqueue(createTask(3)),
      ]);
      
      expect(executionOrder).toEqual([1, 2, 3]);
    }, 5000);
  });

  describe('stress tests', () => {
    it('should handle rapid enqueuing without losing tasks', async () => {
      const taskCount = 100;
      const results: number[] = [];
      
      const promises = Array.from({ length: taskCount }, (_, i) =>
        queue.enqueue(() => {
          results.push(i);
          return Promise.resolve(i);
        })
      );
      
      await Promise.all(promises);
      
      expect(results).toHaveLength(taskCount);
      expect(new Set(results).size).toBe(taskCount);
    }, 10000);

    it('should handle mixed success and failure scenarios', async () => {
      const tasks = Array.from({ length: 20 }, (_, i) =>
        i % 3 === 0
          ? () => Promise.reject(new Error(`Error ${i}`))
          : () => Promise.resolve(`Success ${i}`)
      );
      
      const results = await Promise.allSettled(
        tasks.map(task => queue.enqueue(task))
      );
      
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');
      
      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
      expect(results).toHaveLength(20);
    }, 10000);
  });
});