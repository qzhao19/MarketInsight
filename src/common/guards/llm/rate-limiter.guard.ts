import { Injectable, Logger } from "@nestjs/common";
import { RateLimiterConfig } from "../../../types/llm/client.types"

// A type for items in our internal queue
type WaitingResolver = {
  resolve: () => void;
  reject: (error: Error) => void;
  timestamp: number;
};

@Injectable()
export class RateLimiterGuard {
  private readonly logger: Logger;
  private readonly maxTokens: number;
  private readonly refillRatePerSecond: number;
  private readonly defaultConfig: RateLimiterConfig;
  private readonly maxQueueSize: number;
  private readonly requestTimeout: number;
  private waitingQueue: WaitingResolver[] = [];
  private lastRefillTimestamp: number;
  private tokenBucket: number;
  private isProcessing = false;

  constructor(defaultConfig: RateLimiterConfig) {
    this.defaultConfig = defaultConfig;
    this.maxTokens = this.defaultConfig.maxRequestsPerMinute;
    this.refillRatePerSecond = this.defaultConfig.maxRequestsPerMinute / 60;
    this.tokenBucket = this.maxTokens;
    this.lastRefillTimestamp = Date.now();
    this.maxQueueSize = this.defaultConfig.maxQueueSize;
    this.requestTimeout = this.defaultConfig.requestTimeout;
    this.logger = new Logger(RateLimiterGuard.name);
    this.logger.log(
      `\n` +
      `════════════════════════════════════════════════════════════════\n` +
      `                  Rate Limiter Configuration                    \n` +
      `════════════════════════════════════════════════════════════════\n` +
      `  Max Requests/Min:     ${this.defaultConfig.maxRequestsPerMinute}\n` +
      `  Refill Rate/Sec:      ${this.refillRatePerSecond.toFixed(2)}\n` +
      `  Max Queue Size:       ${this.maxQueueSize}\n` +
      `  Request Timeout:      ${this.requestTimeout}ms\n` +
      `  Initial Tokens:       ${this.maxTokens}\n` +
      `════════════════════════════════════════════════════════════════\n`
    );
  }

  /**
   * Refills the token bucket based on the elapsed time.
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTimestamp) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRatePerSecond;

    if (tokensToAdd > 0) {
      this.tokenBucket = Math.min(
        this.maxTokens,
        Math.max(0, this.tokenBucket) + tokensToAdd,
      );
      this.lastRefillTimestamp = now;
      this.logger.debug(`Refilled tokens. Current: ${this.tokenBucket.toFixed(2)}`);
    }
  }

  /**
   * Clean up expired requests from the queue
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();
    const expiredRequests: WaitingResolver[] = [];

    // Identify all timeout requests
    while (this.waitingQueue.length > 0) {
      const first = this.waitingQueue[0];
      if (now - first.timestamp > this.requestTimeout) {
        const expired = this.waitingQueue.shift();
        if (expired) {
          expiredRequests.push(expired);
        }
      } else {
        break;
      }
    }

    // Reject all timeout requests
    expiredRequests.forEach(req => {
      try {
        req.reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
      } catch (error) {
        this.logger.error(`Error rejecting expired request: ${error}`);
      }
    });

    if (expiredRequests.length > 0) {
      this.logger.warn(`Cleaned up ${expiredRequests.length} expired requests`);
    }
  }

  /**
   * Processes the queue of waiting requests.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.waitingQueue.length === 0) {
      this.logger.debug("Queue processing already in progress, skipping");
      return;
    }
    this.isProcessing = true;

    try {
      while (this.waitingQueue.length > 0) {
        // Clean up expired requests first
        this.cleanupExpiredRequests();
        if (this.waitingQueue.length === 0) {
          break;
        }
        this.refillTokens();

        if (this.tokenBucket >= 1) {
          this.tokenBucket = Math.max(0, this.tokenBucket - 1);;
          const next = this.waitingQueue.shift();
          next?.resolve(); // Resolve the promise of the waiting request
        } else {
          // Not enough tokens, calculate wait time and pause
          const deficit = 1 - Math.max(0, this.tokenBucket);
          const waitTimeMs = Math.ceil((deficit / this.refillRatePerSecond) * 1000);
          const safeWaitTime = Math.min(waitTimeMs, 10000); 
          this.logger.debug(`No tokens. Waiting for ${safeWaitTime}ms.`);
          await new Promise(resolve => setTimeout(resolve, safeWaitTime));
        }
      }
    } catch (error) {
      this.logger.error("Error in queue processing:", error);
      // When an error happened, release all pending requests to prevent suspension.
      while (this.waitingQueue.length > 0) {
        const item = this.waitingQueue.shift();
        if (item) {
          item.reject(new Error("Rate limiter queue processing failed"));
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Acquires a token. If no token is available, it waits until one is.
   * @returns A promise that resolves when a token has been acquired.
   */
  public async acquire(): Promise<void> {
    // Check queue length
    if (this.waitingQueue.length >= this.maxQueueSize) {
      const errorMsg = `Rate limiter queue is full (${this.maxQueueSize} requests)`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const acquirePromise = new Promise<void>((resolve, reject) => {
      this.waitingQueue.push({ 
        resolve, 
        reject,
        timestamp: Date.now() 
      });
      this.logger.debug(
        `Request queued. Queue length: ${this.waitingQueue.length}, ` +
        `Available tokens: ${this.tokenBucket.toFixed(2)}`
      );
    });

    // Use setTimeout to ensure this is asyn
    setImmediate(() => {
      this.processQueue().catch(error => {
        this.logger.error(`Queue processing error: ${error}`);
      });
    });

    return acquirePromise;
  }
}