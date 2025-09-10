import { Injectable, Logger } from '@nestjs/common';

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

  constructor(maxRequestsPerMinute: number = 60, logger?: Logger) {
    this.maxTokens = maxRequestsPerMinute;
    this.refillRatePerSecond = maxRequestsPerMinute / 60;
    this.tokenBucket = this.maxTokens;
    this.lastRefillTimestamp = Date.now();
    this.logger = logger || new Logger(RateLimiterGuard.name);
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
    }
  }

  /**
   * Processes the queue of waiting requests.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.waitingQueue.length === 0) {
      return;
    }
    this.isProcessing = true;

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

    this.isProcessing = false;
  }

  /**
   * Acquires a token. If no token is available, it waits until one is.
   * @returns A promise that resolves when a token has been acquired.
   */
  public async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waitingQueue.push(resolve);
      this.processQueue();
    });
  }
}