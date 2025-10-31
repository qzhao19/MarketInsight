import { RateLimiterGuard } from '../../../src/common/guards/llm/rate-limiter.guard';
import { RateLimiterConfig } from '../../../src/types/llm/client.types';

describe('RateLimiterGuard', () => {
  let rateLimiter: RateLimiterGuard;
  let defaultConfig: RateLimiterConfig;

  beforeEach(() => {
    defaultConfig = {
      maxRequestsPerMinute: 60,
      maxQueueSize: 100,
      requestTimeout: 5000,
    };
    rateLimiter = new RateLimiterGuard(defaultConfig);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(rateLimiter).toBeDefined();
      expect((rateLimiter as any).maxTokens).toBe(60);
      expect((rateLimiter as any).refillRatePerSecond).toBe(1);
      expect((rateLimiter as any).tokenBucket).toBe(60);
      expect((rateLimiter as any).maxQueueSize).toBe(100);
      expect((rateLimiter as any).requestTimeout).toBe(5000);
    });

    it('should calculate refill rate correctly for different maxRequestsPerMinute', () => {
      const customConfig: RateLimiterConfig = {
        maxRequestsPerMinute: 120,
        maxQueueSize: 50,
        requestTimeout: 3000,
      };
      const customLimiter = new RateLimiterGuard(customConfig);
      expect((customLimiter as any).refillRatePerSecond).toBe(2);
    });
  });

  describe('acquire', () => {
    it('should acquire token immediately when tokens are available', async () => {
      const startTime = Date.now();
      await rateLimiter.acquire();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100);
      expect((rateLimiter as any).tokenBucket).toBeLessThan(60);
    });

    it('should handle multiple concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, () => rateLimiter.acquire());
      await Promise.all(promises);
      
      expect((rateLimiter as any).tokenBucket).toBeLessThan(60);
    });

    it('should throw error when queue is full', async () => {
      const smallQueueConfig: RateLimiterConfig = {
        maxRequestsPerMinute: 1,
        maxQueueSize: 2,
        requestTimeout: 5000,
      };
      const limiter = new RateLimiterGuard(smallQueueConfig);
      
      // Exhaust the single available token
      await limiter.acquire();
      
      // Fill the queue (these will wait)
      const p1 = limiter.acquire();
      const p2 = limiter.acquire();
      
      // The next call should return a rejected promise because the queue is full
      await expect(limiter.acquire()).rejects.toThrow('Rate limiter queue is full (2 requests)');
      
      // Clean up pending promises
      await Promise.allSettled([p1, p2]);
    }, 20000);

    it('should wait for token refill when bucket is empty', async () => {
      const lowRateConfig: RateLimiterConfig = {
        maxRequestsPerMinute: 6, // 0.1 tokens per second
        maxQueueSize: 10,
        requestTimeout: 15000,
      };
      const limiter = new RateLimiterGuard(lowRateConfig);
      
      // Exhaust all tokens
      const initialPromises = Array.from({ length: 6 }, () => limiter.acquire());
      await Promise.all(initialPromises);
      
      // Next request should wait
      const startTime = Date.now();
      await limiter.acquire();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThan(9000);
    }, 20000);
  });

  describe('token refill mechanism', () => {
    it('should refill tokens over time', async () => {
      const config: RateLimiterConfig = {
        maxRequestsPerMinute: 60, // 1 token per second
        maxQueueSize: 10,
        requestTimeout: 5000,
      };
      const limiter = new RateLimiterGuard(config);
      
      // Consume some tokens
      await Promise.all([
        limiter.acquire(),
        limiter.acquire(),
        limiter.acquire(),
      ]);
      
      const tokensAfterConsumption = (limiter as any).tokenBucket;
      
      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Trigger refill by acquiring
      await limiter.acquire();
      
      const tokensAfterRefill = (limiter as any).tokenBucket;
      expect(tokensAfterRefill).toBeGreaterThan(tokensAfterConsumption - 1);
    });

    it('should not exceed max tokens', async () => {
      const config: RateLimiterConfig = {
        maxRequestsPerMinute: 10,
        maxQueueSize: 10,
        requestTimeout: 5000,
      };
      const limiter = new RateLimiterGuard(config);
      
      // Wait to ensure potential over-refill
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Trigger refill
      await limiter.acquire();
      
      expect((limiter as any).tokenBucket).toBeLessThanOrEqual(10);
    }, 15000);
  });

  describe('queue processing', () => {
    it('should process queue in FIFO order', async () => {
      const config: RateLimiterConfig = {
        maxRequestsPerMinute: 6, // Slow rate
        maxQueueSize: 10,
        requestTimeout: 10000,
      };
      const limiter = new RateLimiterGuard(config);
      
      const order: number[] = [];
      
      const createRequest = (id: number) => 
        limiter.acquire().then(() => order.push(id));
      
      await Promise.all([
        createRequest(1),
        createRequest(2),
        createRequest(3),
      ]);
      
      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle queue processing errors gracefully', async () => {
      const config: RateLimiterConfig = {
        maxRequestsPerMinute: 60,
        maxQueueSize: 5,
        requestTimeout: 5000,
      };
      const limiter = new RateLimiterGuard(config);
      
      // Should not throw even with rapid concurrent requests
      const promises = Array.from({ length: 5 }, () => limiter.acquire());
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle zero available tokens correctly', async () => {
      const config: RateLimiterConfig = {
        maxRequestsPerMinute: 60, // ✅ Changed from 1 to 60 for faster test
        maxQueueSize: 100,
        requestTimeout: 10000,
      };
      const limiter = new RateLimiterGuard(config);
      
      // Exhaust all tokens
      await Promise.all(Array.from({ length: 60 }, () => limiter.acquire()));
      
      // Should wait for about 1 second for refill
      const startTime = Date.now();
      await limiter.acquire();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeGreaterThanOrEqual(900);
    }, 15000);

    it('should handle fractional tokens correctly', async () => {
      const config: RateLimiterConfig = {
        maxRequestsPerMinute: 30, // 0.5 tokens per second
        maxQueueSize: 10,
        requestTimeout: 10000,
      };
      const limiter = new RateLimiterGuard(config);
      
      await limiter.acquire();
      expect((limiter as any).tokenBucket).toBeGreaterThanOrEqual(0);
      expect((limiter as any).tokenBucket).toBeLessThan(30);
    });

    it('should handle very high request rates', async () => {
      const config: RateLimiterConfig = {
        maxRequestsPerMinute: 600,
        maxQueueSize: 100,
        requestTimeout: 5000,
      };
      const limiter = new RateLimiterGuard(config);
      
      const promises = Array.from({ length: 50 }, () => limiter.acquire());
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('concurrent queue management', () => {
    it('should prevent race conditions in queue processing', async () => {
      const config: RateLimiterConfig = {
        maxRequestsPerMinute: 30,
        maxQueueSize: 20,
        requestTimeout: 10000,
      };
      const limiter = new RateLimiterGuard(config);
      
      // Rapidly fire requests
      const promises = Array.from({ length: 15 }, (_, i) => 
        limiter.acquire().then(() => i)
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(15);
      expect(new Set(results).size).toBe(15); // All unique
    });
  });
});