import { RetryGuard } from '../../../src/common/guards/llm/retry.guard';
import { RetryConfig } from '../../../src/types/llm/client.types';

describe('RetryGuard', () => {
  let retryGuard: RetryGuard;
  let defaultConfig: RetryConfig;

  beforeEach(() => {
    defaultConfig = {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      factor: 2,
      retryableErrors: [],
      jitter: false,
    };
    retryGuard = new RetryGuard(defaultConfig);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(retryGuard).toBeDefined();
      expect((retryGuard as any).defaultConfig).toEqual(defaultConfig);
    });

    it('should initialize with different configurations', () => {
      const customConfig: RetryConfig = {
        maxRetries: 5,
        initialDelayMs: 200,
        maxDelayMs: 10000,
        factor: 3,
        retryableErrors: [/timeout/i],
        jitter: true,
      };
      const customGuard = new RetryGuard(customConfig);
      expect((customGuard as any).defaultConfig).toEqual(customConfig);
    });
  });

  describe('exponentialBackoff', () => {
    it('should return result on first successful attempt', async () => {
      const mockFunc = jest.fn().mockResolvedValue('success');
      
      const result = await retryGuard.exponentialBackoff(mockFunc);
      
      expect(result).toBe('success');
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      const result = await retryGuard.exponentialBackoff(mockFunc);
      const duration = Date.now() - startTime;
      
      expect(result).toBe('success');
      expect(mockFunc).toHaveBeenCalledTimes(2);
      // Should wait ~100ms (initialDelayMs)
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(200);
    }, 5000);

    it('should apply exponential backoff correctly', async () => {
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      const result = await retryGuard.exponentialBackoff(mockFunc);
      const duration = Date.now() - startTime;
      
      expect(result).toBe('success');
      expect(mockFunc).toHaveBeenCalledTimes(3);
      // Delays: 100ms (attempt 1), 200ms (attempt 2)
      // Total: ~300ms
      expect(duration).toBeGreaterThanOrEqual(280);
      expect(duration).toBeLessThan(400);
    }, 5000);

    it('should throw error after all retries exhausted', async () => {
      const error = new Error('Persistent failure');
      const mockFunc = jest.fn().mockRejectedValue(error);
      
      await expect(retryGuard.exponentialBackoff(mockFunc)).rejects.toThrow('Persistent failure');
      
      // Should be called 4 times: 1 initial + 3 retries
      expect(mockFunc).toHaveBeenCalledTimes(4);
    }, 10000);

    it('should respect maxDelayMs', async () => {
      const configWithLowMax: RetryConfig = {
        maxRetries: 5,
        initialDelayMs: 100,
        maxDelayMs: 150,
        factor: 2,
        retryableErrors: [],
        jitter: false,
      };
      const guard = new RetryGuard(configWithLowMax);
      
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockRejectedValueOnce(new Error('Failure 3'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      await guard.exponentialBackoff(mockFunc);
      const duration = Date.now() - startTime;
      
      // Delays: 100ms, 150ms (capped), 150ms (capped)
      // Total: ~400ms
      expect(duration).toBeGreaterThanOrEqual(380);
      expect(duration).toBeLessThan(500);
    }, 5000);

    it('should apply jitter when enabled', async () => {
      const configWithJitter: RetryConfig = {
        maxRetries: 2,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        factor: 2,
        retryableErrors: [],
        jitter: true,
      };
      const guard = new RetryGuard(configWithJitter);
      
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      await guard.exponentialBackoff(mockFunc);
      const duration = Date.now() - startTime;
      
      // Delay with jitter: 100ms + (0 to 20ms)
      // Should be between 90ms and 140ms
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(140);
    }, 5000);

    it('should only retry retryable errors when specified', async () => {
      const configWithRetryableErrors: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        factor: 2,
        retryableErrors: [/timeout/i, /network/i],
        jitter: false,
      };
      const guard = new RetryGuard(configWithRetryableErrors);
      
      const retryableError = new Error('Request timeout');
      const mockFunc = jest.fn().mockRejectedValue(retryableError);
      
      await expect(guard.exponentialBackoff(mockFunc)).rejects.toThrow('Request timeout');
      
      // Should retry because error matches pattern
      expect(mockFunc).toHaveBeenCalledTimes(4); // 1 + 3 retries
    }, 10000);

    it('should not retry non-retryable errors', async () => {
      const configWithRetryableErrors: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        factor: 2,
        retryableErrors: [/timeout/i, /network/i],
        jitter: false,
      };
      const guard = new RetryGuard(configWithRetryableErrors);
      
      const nonRetryableError = new Error('Invalid input');
      const mockFunc = jest.fn().mockRejectedValue(nonRetryableError);
      
      await expect(guard.exponentialBackoff(mockFunc)).rejects.toThrow('Invalid input');
      
      // Should not retry because error doesn't match pattern
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error rejections', async () => {
      const mockFunc = jest.fn().mockRejectedValue('string error');
      
      await expect(retryGuard.exponentialBackoff(mockFunc)).rejects.toBe('string error');
      
      expect(mockFunc).toHaveBeenCalledTimes(4); // 1 + 3 retries
    }, 10000);

    it('should handle successful retry after multiple failures', async () => {
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockRejectedValueOnce(new Error('Failure 3'))
        .mockResolvedValueOnce('finally success');
      
      const result = await retryGuard.exponentialBackoff(mockFunc);
      
      expect(result).toBe('finally success');
      expect(mockFunc).toHaveBeenCalledTimes(4);
    }, 10000);
  });

  describe('edge cases', () => {
    it('should handle zero retries', async () => {
      const configNoRetry: RetryConfig = {
        maxRetries: 0,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        factor: 2,
        retryableErrors: [],
        jitter: false,
      };
      const guard = new RetryGuard(configNoRetry);
      
      const mockFunc = jest.fn().mockRejectedValue(new Error('Failure'));
      
      await expect(guard.exponentialBackoff(mockFunc)).rejects.toThrow('Failure');
      
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('should handle very large factor', async () => {
      const configLargeFactor: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        factor: 10,
        retryableErrors: [],
        jitter: false,
      };
      const guard = new RetryGuard(configLargeFactor);
      
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      await guard.exponentialBackoff(mockFunc);
      const duration = Date.now() - startTime;
      
      // Delays: 10ms, 100ms (capped at maxDelayMs)
      // Total: ~110ms
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200);
    }, 5000);

    it('should handle factor of 1 (linear backoff)', async () => {
      const configLinear: RetryConfig = {
        maxRetries: 2,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        factor: 1,
        retryableErrors: [],
        jitter: false,
      };
      const guard = new RetryGuard(configLinear);
      
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      await guard.exponentialBackoff(mockFunc);
      const duration = Date.now() - startTime;
      
      // Delays: 100ms, 100ms (factor=1, no increase)
      // Total: ~200ms
      expect(duration).toBeGreaterThanOrEqual(190);
      expect(duration).toBeLessThan(300);
    }, 5000);

    it('should handle promises that resolve synchronously', async () => {
      const mockFunc = jest.fn(() => Promise.resolve('sync success'));
      
      const result = await retryGuard.exponentialBackoff(mockFunc);
      
      expect(result).toBe('sync success');
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('should handle empty retryableErrors array (retry all errors)', async () => {
      const configRetryAll: RetryConfig = {
        maxRetries: 2,
        initialDelayMs: 50,
        maxDelayMs: 5000,
        factor: 2,
        retryableErrors: [],
        jitter: false,
      };
      const guard = new RetryGuard(configRetryAll);
      
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error('Any error'))
        .mockResolvedValueOnce('success');
      
      const result = await guard.exponentialBackoff(mockFunc);
      
      expect(result).toBe('success');
      expect(mockFunc).toHaveBeenCalledTimes(2);
    }, 5000);
  });

  describe('stress tests', () => {
    it('should handle rapid successive calls', async () => {
      const mockFunc = jest.fn().mockResolvedValue('success');
      
      const promises = Array.from({ length: 10 }, () =>
        retryGuard.exponentialBackoff(mockFunc)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r === 'success')).toBe(true);
      expect(mockFunc).toHaveBeenCalledTimes(10);
    });

    it('should handle multiple concurrent retrying operations', async () => {
      let callCount = 0;
      const mockFunc = jest.fn(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.resolve('success');
        }
        return Promise.reject(new Error('Failure'));
      });
      
      const promises = Array.from({ length: 5 }, () =>
        retryGuard.exponentialBackoff(mockFunc)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r === 'success')).toBe(true);
      expect(mockFunc).toHaveBeenCalledTimes(10); // Each call retries once
    }, 10000);

    it('should handle very long retry sequences', async () => {
      const configManyRetries: RetryConfig = {
        maxRetries: 10,
        initialDelayMs: 10,
        maxDelayMs: 50,
        factor: 1.5,
        retryableErrors: [],
        jitter: false,
      };
      const guard = new RetryGuard(configManyRetries);
      
      let attempts = 0;
      const mockFunc = jest.fn(() => {
        attempts++;
        if (attempts < 8) {
          return Promise.reject(new Error(`Failure ${attempts}`));
        }
        return Promise.resolve('finally success');
      });
      
      const result = await guard.exponentialBackoff(mockFunc);
      
      expect(result).toBe('finally success');
      expect(mockFunc).toHaveBeenCalledTimes(8);
    }, 10000);
  });

  describe('logging behavior', () => {
    it('should log retry success message', async () => {
      const logSpy = jest.spyOn((retryGuard as any).logger, 'log');
      
      const mockFunc = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');
      
      await retryGuard.exponentialBackoff(mockFunc);
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retry successful on attempt 2')
      );
    }, 5000);

    it('should log exhausted retries message', async () => {
      const errorSpy = jest.spyOn((retryGuard as any).logger, 'error');
      
      const mockFunc = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(retryGuard.exponentialBackoff(mockFunc)).rejects.toThrow();
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('All retry attempts exhausted')
      );
    }, 10000);

    it('should log non-retryable error message', async () => {
      const configWithRetryable: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        factor: 2,
        retryableErrors: [/timeout/i],
        jitter: false,
      };
      const guard = new RetryGuard(configWithRetryable);
      const warnSpy = jest.spyOn((guard as any).logger, 'warn');
      
      const mockFunc = jest.fn().mockRejectedValue(new Error('Invalid input'));
      
      await expect(guard.exponentialBackoff(mockFunc)).rejects.toThrow();
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('is not retryable')
      );
    });
  });
});