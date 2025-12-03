import { CircuitBreakerGuard } from '../../../src/common/guards/llm/circuit-breaker.guard';
import { CircuitBreakerConfig } from '../../../src/common/types/llm/client.types';

describe('CircuitBreakerGuard', () => {
  let guard: CircuitBreakerGuard;
  
  const mockConfig: CircuitBreakerConfig = {
    resetTimeout: 10000,
    timeout: 3000,
    errorThresholdPercentage: 50,
    rollingCountTimeout: 10000,
    volumeThreshold: 5,
    capacity: 10,
    name: 'test-breaker',
  };

  beforeEach(() => {
    guard = new CircuitBreakerGuard(mockConfig);
  });

  afterEach(() => {
    if (guard) {
      guard.onApplicationShutdown();
    }
  });

  describe('Initialization', () => {
    test('should be defined', () => {
      expect(guard).toBeDefined();
      expect(guard).toBeInstanceOf(CircuitBreakerGuard);
    });

    test('should initialize with empty breakers map', () => {
      expect(guard.getAllBreakerNames()).toEqual([]);
      expect(guard.getAllBreakerNames().length).toBe(0);
    });

    test('should accept valid configuration', () => {
      const customConfig: CircuitBreakerConfig = {
        resetTimeout: 5000,
        timeout: 2000,
        errorThresholdPercentage: 60,
        rollingCountTimeout: 8000,
        volumeThreshold: 3,
        capacity: 5,
        name: 'custom-breaker',
      };

      const customGuard = new CircuitBreakerGuard(customConfig);
      
      expect(customGuard).toBeDefined();
      expect(customGuard.getAllBreakerNames()).toEqual([]);

      customGuard.onApplicationShutdown();
    });
  });

  describe('getOrCreateBreaker - Create New', () => {
    test('should create a new circuit breaker', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      const breaker = guard.getOrCreateBreaker('test-1', mockFunc);
      
      expect(breaker).toBeDefined();
      expect(guard.hasBreaker('test-1')).toBe(true);
      expect(guard.getAllBreakerNames()).toContain('test-1');
      expect(guard.getAllBreakerNames().length).toBe(1);
    });

    test('should create breaker with fallback function', () => {
      const mockFunc = jest.fn(async () => {
        throw new Error('Test error');
      });
      const fallbackFunc = jest.fn(async () => 'fallback');
      
      const breaker = guard.getOrCreateBreaker('test-2', mockFunc, fallbackFunc);
      
      expect(breaker).toBeDefined();
      expect(guard.hasBreaker('test-2')).toBe(true);
    });

    test('should throw error for empty breaker name', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      expect(() => guard.getOrCreateBreaker('', mockFunc)).toThrow(
        'Circuit breaker name cannot be empty'
      );
    });

    test('should throw error for whitespace-only breaker name', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      expect(() => guard.getOrCreateBreaker('   ', mockFunc)).toThrow(
        'Circuit breaker name cannot be empty'
      );
      
      expect(() => guard.getOrCreateBreaker('\t\n', mockFunc)).toThrow(
        'Circuit breaker name cannot be empty'
      );
    });

    test('should create multiple breakers with different names', () => {
      const mockFunc1 = jest.fn(async () => 'success1');
      const mockFunc2 = jest.fn(async () => 'success2');
      const mockFunc3 = jest.fn(async () => 'success3');
      
      const breaker1 = guard.getOrCreateBreaker('breaker-1', mockFunc1);
      const breaker2 = guard.getOrCreateBreaker('breaker-2', mockFunc2);
      const breaker3 = guard.getOrCreateBreaker('breaker-3', mockFunc3);
      
      expect(breaker1).toBeDefined();
      expect(breaker2).toBeDefined();
      expect(breaker3).toBeDefined();
      expect(breaker1).not.toBe(breaker2);
      expect(breaker2).not.toBe(breaker3);
      
      const names = guard.getAllBreakerNames();
      expect(names).toHaveLength(3);
      expect(names).toEqual(expect.arrayContaining(['breaker-1', 'breaker-2', 'breaker-3']));
    });

    test('should accept complex function signatures', () => {
      const mockFunc = jest.fn(async (a: number, b: string, c: object) => {
        return { result: a + b.length + Object.keys(c).length };
      });
      
      const breaker = guard.getOrCreateBreaker('complex-func', mockFunc);
      
      expect(breaker).toBeDefined();
    });
  });

  describe('getOrCreateBreaker - Reuse Existing', () => {
    test('should reuse existing breaker with same name', () => {
      const mockFunc1 = jest.fn(async () => 'success1');
      const mockFunc2 = jest.fn(async () => 'success2');
      
      const breaker1 = guard.getOrCreateBreaker('test-reuse', mockFunc1);
      const breaker2 = guard.getOrCreateBreaker('test-reuse', mockFunc2);
      
      expect(breaker1).toBe(breaker2);
      expect(guard.getAllBreakerNames().length).toBe(1);
    });

    test('should ignore new fallback when reusing breaker', () => {
      const mockFunc = jest.fn(async () => 'success');
      const fallback1 = jest.fn(async () => 'fallback1');
      const fallback2 = jest.fn(async () => 'fallback2');
      
      const breaker1 = guard.getOrCreateBreaker('test-fallback', mockFunc, fallback1);
      const breaker2 = guard.getOrCreateBreaker('test-fallback', mockFunc, fallback2);
      
      expect(breaker1).toBe(breaker2);
      expect(guard.getAllBreakerNames().length).toBe(1);
    });

    test('should reuse breaker multiple times', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      const breaker1 = guard.getOrCreateBreaker('multi-reuse', mockFunc);
      const breaker2 = guard.getOrCreateBreaker('multi-reuse', mockFunc);
      const breaker3 = guard.getOrCreateBreaker('multi-reuse', mockFunc);
      const breaker4 = guard.getOrCreateBreaker('multi-reuse', mockFunc);
      
      expect(breaker1).toBe(breaker2);
      expect(breaker2).toBe(breaker3);
      expect(breaker3).toBe(breaker4);
      expect(guard.getAllBreakerNames().length).toBe(1);
    });
  });

  describe('getBreaker', () => {
    test('should return existing breaker', () => {
      const mockFunc = jest.fn(async () => 'success');
      const createdBreaker = guard.getOrCreateBreaker('test-get', mockFunc);
      
      const retrievedBreaker = guard.getBreaker('test-get');
      
      expect(retrievedBreaker).toBe(createdBreaker);
      expect(retrievedBreaker).toBeDefined();
    });

    test('should return undefined for non-existent breaker', () => {
      const breaker = guard.getBreaker('non-existent');
      
      expect(breaker).toBeUndefined();
    });

    test('should return undefined for empty string name', () => {
      const breaker = guard.getBreaker('');
      
      expect(breaker).toBeUndefined();
    });

    test('should handle special characters in breaker name', () => {
      const mockFunc = jest.fn(async () => 'success');
      const specialName = 'breaker-with-特殊字符-123_@#';
      
      guard.getOrCreateBreaker(specialName, mockFunc);
      const breaker = guard.getBreaker(specialName);
      
      expect(breaker).toBeDefined();
    });
  });

  describe('hasBreaker', () => {
    test('should return true for existing breaker', () => {
      const mockFunc = jest.fn(async () => 'success');
      guard.getOrCreateBreaker('test-has', mockFunc);
      
      expect(guard.hasBreaker('test-has')).toBe(true);
    });

    test('should return false for non-existent breaker', () => {
      expect(guard.hasBreaker('non-existent')).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(guard.hasBreaker('')).toBe(false);
    });

    test('should correctly reflect breaker state after creation and deletion', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      expect(guard.hasBreaker('temp-breaker')).toBe(false);
      
      guard.getOrCreateBreaker('temp-breaker', mockFunc);
      expect(guard.hasBreaker('temp-breaker')).toBe(true);
      
      guard.onApplicationShutdown();
      expect(guard.hasBreaker('temp-breaker')).toBe(false);
    });
  });

  describe('getAllBreakerNames', () => {
    test('should return all breaker names', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      guard.getOrCreateBreaker('breaker-a', mockFunc);
      guard.getOrCreateBreaker('breaker-b', mockFunc);
      guard.getOrCreateBreaker('breaker-c', mockFunc);
      
      const names = guard.getAllBreakerNames();
      
      expect(names).toHaveLength(3);
      expect(names).toContain('breaker-a');
      expect(names).toContain('breaker-b');
      expect(names).toContain('breaker-c');
    });

    test('should return empty array when no breakers exist', () => {
      expect(guard.getAllBreakerNames()).toEqual([]);
      expect(guard.getAllBreakerNames().length).toBe(0);
    });

    test('should return updated list after adding breakers', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      expect(guard.getAllBreakerNames()).toHaveLength(0);
      
      guard.getOrCreateBreaker('first', mockFunc);
      expect(guard.getAllBreakerNames()).toHaveLength(1);
      
      guard.getOrCreateBreaker('second', mockFunc);
      expect(guard.getAllBreakerNames()).toHaveLength(2);
      
      guard.getOrCreateBreaker('third', mockFunc);
      expect(guard.getAllBreakerNames()).toHaveLength(3);
    });

    test('should not include duplicate names when reusing breakers', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      guard.getOrCreateBreaker('duplicate', mockFunc);
      guard.getOrCreateBreaker('duplicate', mockFunc);
      guard.getOrCreateBreaker('duplicate', mockFunc);
      
      expect(guard.getAllBreakerNames()).toEqual(['duplicate']);
      expect(guard.getAllBreakerNames()).toHaveLength(1);
    });
  });

  describe('getBreakerStats', () => {
    test('should return stats for existing breaker after execution', async () => {
      const mockFunc = jest.fn(async () => 'success');
      const breaker = guard.getOrCreateBreaker('test-stats', mockFunc);
      
      // Execute the breaker to generate some stats
      await breaker.fire();
      
      const stats = guard.getBreakerStats('test-stats');
      
      expect(stats).toBeDefined();
      expect(stats?.fires).toBeGreaterThan(0);
      expect(stats?.successes).toBe(1);
    });

    test('should return undefined for non-existent breaker', () => {
      const stats = guard.getBreakerStats('non-existent');
      
      expect(stats).toBeUndefined();
    });

    test('should track failure stats', async () => {
      const mockFunc = jest.fn(async () => {
        throw new Error('Test error');
      });
      const breaker = guard.getOrCreateBreaker('test-failures', mockFunc);
      
      // Execute and catch error
      try {
        await breaker.fire();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Expected
      }
      
      const stats = guard.getBreakerStats('test-failures');
      
      expect(stats).toBeDefined();
      expect(stats?.failures).toBe(1);
    });

    test('should return stats with zero values for unused breaker', () => {
      const mockFunc = jest.fn(async () => 'success');
      guard.getOrCreateBreaker('unused', mockFunc);
      
      const stats = guard.getBreakerStats('unused');
      
      expect(stats).toBeDefined();
      expect(stats?.fires).toBe(0);
      expect(stats?.successes).toBe(0);
      expect(stats?.failures).toBe(0);
    });
  });

  describe('openBreaker', () => {
    test('should manually open a breaker', () => {
      const mockFunc = jest.fn(async () => 'success');
      guard.getOrCreateBreaker('test-open', mockFunc);
      
      guard.openBreaker('test-open');
      
      const breaker = guard.getBreaker('test-open');
      expect(breaker?.opened).toBe(true);
    });

    test('should not throw error for non-existent breaker', () => {
      expect(() => guard.openBreaker('non-existent')).not.toThrow();
    });

    test('should keep breaker open after manual open', async () => {
      const mockFunc = jest.fn(async () => 'success');
      guard.getOrCreateBreaker('stay-open', mockFunc);
      
      guard.openBreaker('stay-open');
      
      const breaker = guard.getBreaker('stay-open');
      expect(breaker?.opened).toBe(true);
      
      // Verify it stays open
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(breaker?.opened).toBe(true);
    });

    test('should open multiple breakers independently', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      guard.getOrCreateBreaker('breaker-1', mockFunc);
      guard.getOrCreateBreaker('breaker-2', mockFunc);
      guard.getOrCreateBreaker('breaker-3', mockFunc);
      
      guard.openBreaker('breaker-1');
      guard.openBreaker('breaker-3');
      
      expect(guard.getBreaker('breaker-1')?.opened).toBe(true);
      expect(guard.getBreaker('breaker-2')?.opened).toBe(false);
      expect(guard.getBreaker('breaker-3')?.opened).toBe(true);
    });
  });

  describe('closeBreaker', () => {
    test('should manually close a breaker', () => {
      const mockFunc = jest.fn(async () => 'success');
      guard.getOrCreateBreaker('test-close', mockFunc);
      
      guard.openBreaker('test-close');
      expect(guard.getBreaker('test-close')?.opened).toBe(true);
      
      guard.closeBreaker('test-close');
      expect(guard.getBreaker('test-close')?.opened).toBe(false);
    });

    test('should not throw error for non-existent breaker', () => {
      expect(() => guard.closeBreaker('non-existent')).not.toThrow();
    });

    test('should handle closing already closed breaker', () => {
      const mockFunc = jest.fn(async () => 'success');
      guard.getOrCreateBreaker('already-closed', mockFunc);
      
      expect(guard.getBreaker('already-closed')?.opened).toBe(false);
      
      expect(() => guard.closeBreaker('already-closed')).not.toThrow();
      expect(guard.getBreaker('already-closed')?.opened).toBe(false);
    });

    test('should close multiple breakers independently', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      guard.getOrCreateBreaker('breaker-1', mockFunc);
      guard.getOrCreateBreaker('breaker-2', mockFunc);
      guard.getOrCreateBreaker('breaker-3', mockFunc);
      
      // Open all
      guard.openBreaker('breaker-1');
      guard.openBreaker('breaker-2');
      guard.openBreaker('breaker-3');
      
      // Close only breaker-2
      guard.closeBreaker('breaker-2');
      
      expect(guard.getBreaker('breaker-1')?.opened).toBe(true);
      expect(guard.getBreaker('breaker-2')?.opened).toBe(false);
      expect(guard.getBreaker('breaker-3')?.opened).toBe(true);
    });
  });

  describe('Circuit Breaker Functionality', () => {
    test('should execute successful function', async () => {
      const mockFunc = jest.fn(async () => 'success');
      const breaker = guard.getOrCreateBreaker('test-success', mockFunc);
      
      const result = await breaker.fire();
      
      expect(result).toBe('success');
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    test('should handle function failure', async () => {
      const mockFunc = jest.fn(async () => {
        throw new Error('Test error');
      });
      const breaker = guard.getOrCreateBreaker('test-failure', mockFunc);
      
      await expect(breaker.fire()).rejects.toThrow('Test error');
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    test('should execute fallback on circuit open', async () => {
      const mockFunc = jest.fn(async () => {
        throw new Error('Test error');
      });
      const fallbackFunc = jest.fn(async () => 'fallback');
      const breaker = guard.getOrCreateBreaker('test-fallback-exec', mockFunc, fallbackFunc);
      
      // Manually open the circuit
      guard.openBreaker('test-fallback-exec');
      
      const result = await breaker.fire();
      
      expect(result).toBe('fallback');
      expect(fallbackFunc).toHaveBeenCalled();
    });

    test('should pass arguments to wrapped function', async () => {
      const mockFunc = jest.fn(async (a: string, b: number, c: boolean) => {
        return `${a}-${b}-${c}`;
      });
      const breaker = guard.getOrCreateBreaker('test-args', mockFunc);
      
      await breaker.fire('test', 123, true);
      
      expect(mockFunc).toHaveBeenCalledWith('test', 123, true);
    });

    test('should handle multiple sequential calls', async () => {
      const mockFunc = jest.fn(async (x: number) => x * 2);
      const breaker = guard.getOrCreateBreaker('test-sequential', mockFunc);
      
      const result1 = await breaker.fire(5);
      const result2 = await breaker.fire(10);
      const result3 = await breaker.fire(15);
      
      expect(result1).toBe(10);
      expect(result2).toBe(20);
      expect(result3).toBe(30);
      expect(mockFunc).toHaveBeenCalledTimes(3);
    });

    // test('should handle async function with delay', async () => {
    //   const mockFunc = jest.fn(async () => {
    //     await new Promise(resolve => setTimeout(resolve, 100));
    //     return 'delayed-success';
    //   });
    //   const breaker = guard.getOrCreateBreaker('test-delay', mockFunc);      
    //   const result = await breaker.fire();
    //   expect(result).toBe('delayed-success');
    //   expect(mockFunc).toHaveBeenCalledTimes(1);
    // });
  });

  describe('onApplicationShutdown', () => {
    test('should shutdown all breakers', () => {
      const mockFunc = jest.fn(async () => 'success');
      
      guard.getOrCreateBreaker('breaker-1', mockFunc);
      guard.getOrCreateBreaker('breaker-2', mockFunc);
      guard.getOrCreateBreaker('breaker-3', mockFunc);
      
      expect(guard.getAllBreakerNames()).toHaveLength(3);
      
      guard.onApplicationShutdown('SIGTERM');
      
      expect(guard.getAllBreakerNames()).toHaveLength(0);
    });

    test('should handle shutdown without signal', () => {
      const mockFunc = jest.fn(async () => 'success');
      guard.getOrCreateBreaker('test-shutdown', mockFunc);
      
      expect(() => guard.onApplicationShutdown()).not.toThrow();
      expect(guard.getAllBreakerNames()).toHaveLength(0);
    });

    test('should handle shutdown of empty guard', () => {
      expect(() => guard.onApplicationShutdown()).not.toThrow();
      expect(guard.getAllBreakerNames()).toHaveLength(0);
    });

    test('should handle shutdown with different signals', () => {
      const mockFunc = jest.fn(async () => 'success');
      guard.getOrCreateBreaker('sig-test', mockFunc);
      
      const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
      
      signals.forEach((signal, index) => {
        if (index > 0) {
          guard.getOrCreateBreaker(`sig-test-${index}`, mockFunc);
        }
        expect(() => guard.onApplicationShutdown(signal)).not.toThrow();
      });
    });

    test('should be idempotent - multiple shutdowns should be safe', () => {
      const mockFunc = jest.fn(async () => 'success');
      guard.getOrCreateBreaker('idempotent', mockFunc);
      
      guard.onApplicationShutdown();
      expect(() => guard.onApplicationShutdown()).not.toThrow();
      expect(() => guard.onApplicationShutdown()).not.toThrow();
      
      expect(guard.getAllBreakerNames()).toHaveLength(0);
    });
  });

  describe('Concurrency', () => {
    test('should handle concurrent breaker creation safely', async () => {
      const mockFunc = jest.fn(async () => 'success');
      
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(guard.getOrCreateBreaker(`breaker-${i}`, mockFunc))
      );
      
      const breakers = await Promise.all(promises);
      
      expect(breakers).toHaveLength(10);
      expect(guard.getAllBreakerNames()).toHaveLength(10);
      
      // Verify all breakers are unique
      const uniqueBreakers = new Set(breakers);
      expect(uniqueBreakers.size).toBe(10);
    });

    test('should reuse breaker when accessed concurrently with same name', async () => {
      const mockFunc = jest.fn(async () => 'success');
      
      const promises = Array.from({ length: 5 }, () =>
        Promise.resolve(guard.getOrCreateBreaker('shared-breaker', mockFunc))
      );
      
      const breakers = await Promise.all(promises);
      
      // All should be the same instance
      expect(breakers.every(b => b === breakers[0])).toBe(true);
      expect(guard.getAllBreakerNames()).toEqual(['shared-breaker']);
      expect(guard.getAllBreakerNames()).toHaveLength(1);
    });

    test('should handle concurrent execution of same breaker', async () => {
      let counter = 0;
      const mockFunc = jest.fn(async () => {
        counter++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return counter;
      });
      
      const breaker = guard.getOrCreateBreaker('concurrent-exec', mockFunc);
      
      const promises = Array.from({ length: 5 }, () => breaker.fire());
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(mockFunc).toHaveBeenCalledTimes(5);
      expect(counter).toBe(5);
    });

    test('should handle concurrent operations on different breakers', async () => {
      const createAndExecute = async (name: string, value: number) => {
        const mockFunc = jest.fn(async () => value);
        const breaker = guard.getOrCreateBreaker(name, mockFunc);
        return breaker.fire();
      };
      
      const promises = [
        createAndExecute('breaker-a', 1),
        createAndExecute('breaker-b', 2),
        createAndExecute('breaker-c', 3),
        createAndExecute('breaker-d', 4),
        createAndExecute('breaker-e', 5),
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toEqual([1, 2, 3, 4, 5]);
      expect(guard.getAllBreakerNames()).toHaveLength(5);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long breaker names', () => {
      const longName = 'a'.repeat(1000);
      const mockFunc = jest.fn(async () => 'success');
      
      const breaker = guard.getOrCreateBreaker(longName, mockFunc);
      
      expect(breaker).toBeDefined();
      expect(guard.hasBreaker(longName)).toBe(true);
    });

    test('should handle special characters in breaker names', () => {
      const specialNames = [
        'breaker-with-中文',
        'breaker_with_underscore',
        'breaker.with.dots',
        'breaker@with@at',
        'breaker#with#hash',
        'breaker$with$dollar',
      ];
      
      const mockFunc = jest.fn(async () => 'success');
      
      specialNames.forEach(name => {
        const breaker = guard.getOrCreateBreaker(name, mockFunc);
        expect(breaker).toBeDefined();
        expect(guard.hasBreaker(name)).toBe(true);
      });
      
      expect(guard.getAllBreakerNames()).toHaveLength(specialNames.length);
    });

    test('should handle function that returns undefined', async () => {
      const mockFunc = jest.fn(async () => undefined);
      const breaker = guard.getOrCreateBreaker('undefined-return', mockFunc);
      
      const result = await breaker.fire();
      
      expect(result).toBeUndefined();
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    test('should handle function that returns null', async () => {
      const mockFunc = jest.fn(async () => null);
      const breaker = guard.getOrCreateBreaker('null-return', mockFunc);
      
      const result = await breaker.fire();
      
      expect(result).toBeNull();
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    test('should handle function that returns complex objects', async () => {
      const complexObject = {
        nested: {
          deeply: {
            value: 'test',
            array: [1, 2, 3],
            map: new Map([['key', 'value']]),
          },
        },
      };
      
      const mockFunc = jest.fn(async () => complexObject);
      const breaker = guard.getOrCreateBreaker('complex-return', mockFunc);
      
      const result = await breaker.fire();
      
      expect(result).toEqual(complexObject);
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });
  });
});