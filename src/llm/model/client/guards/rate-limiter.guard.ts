import { Injectable, Logger } from "@nestjs/common";

// A type for items in our internal queue
type WaitingResolver = () => void;

@Injectable()
export class RateLimiterGuard {
  private readonly logger: Logger;
  private tokenBucket: number;
  private lastRefillTimestamp: number;
  private readonly maxTokens: number;
  private readonly refillRatePerSecond: number;
  private waitingQueue: WaitingResolver[] = [];
  private isProcessing = false;

  constructor(maxRequestsPerMinute: number = 60) {
    this.maxTokens = maxRequestsPerMinute;
    this.refillRatePerSecond = maxRequestsPerMinute / 60;
    this.tokenBucket = this.maxTokens;
    this.lastRefillTimestamp = Date.now();
    this.logger = new Logger(RateLimiterGuard.name);
    this.logger.log(
      `Rate limiter initialized: ${maxRequestsPerMinute} requests/minute.`,
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
        this.tokenBucket + tokensToAdd,
      );
      this.lastRefillTimestamp = now;
      this.logger.debug(`Refilled tokens. Current: ${this.tokenBucket.toFixed(2)}`);
    }
  }

  /**
   * Processes the queue of waiting requests.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.waitingQueue.length === 0) {
      this.logger.debug('Queue processing already in progress, skipping');
      return;
    }
    this.isProcessing = true;

    try {
      while (this.waitingQueue.length > 0) {
        this.refillTokens();

        if (this.tokenBucket >= 1) {
          this.tokenBucket -= 1;
          const nextResolver = this.waitingQueue.shift();
          nextResolver?.(); // Resolve the promise of the waiting request
        } else {
          // Not enough tokens, calculate wait time and pause
          const deficit = 1 - this.tokenBucket;
          const waitTimeMs = Math.ceil((deficit / this.refillRatePerSecond) * 1000);
          this.logger.debug(`No tokens. Waiting for ${waitTimeMs}ms.`);
          await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        }
      }
    } catch (error) {
      this.logger.error('Error in queue processing:', error);
      // When an error happened, release all pending requests to prevent suspension.
      while (this.waitingQueue.length > 0) {
        const resolver = this.waitingQueue.shift();
        if (resolver) {
          resolver();
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
    const acquirePromise = new Promise<void>((resolve) => {
      this.waitingQueue.push(resolve);
      this.logger.debug(
        `Request queued. Queue length: ${this.waitingQueue.length}, ` +
        `Available tokens: ${this.tokenBucket.toFixed(2)}`
      );
    });

    // Use setTimeout to ensure this is asyn
    setTimeout(() => {
      this.processQueue().catch(error => {
        this.logger.error(`Queue processing error: ${error}`);
      });
    }, 0);

    return acquirePromise;
  }
}