import { Injectable, Logger } from '@nestjs/common';

// Define default options in a constant for clarity
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
  retryableErrors: [] as RegExp[],
  jitter: true,
};

export type RetryOptions = Partial<Omit<typeof DEFAULT_RETRY_OPTIONS, 'retryableErrors'> & { retryableErrors: RegExp[] }>;

// Helper function for sleeping
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class RetryGuard {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger(RetryGuard.name);
  }

  public async exponentialBackoff<T>(
    func: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    // Merge user options with defaults
    const { 
      maxRetries, 
      initialDelayMs, 
      maxDelayMs, 
      factor, 
      retryableErrors,
      jitter,
    } = { ...DEFAULT_RETRY_OPTIONS, ...options };

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await func();
      } catch (error) {
        // If this was the last attempt, throw the error
        if (attempt > maxRetries) {
          this.logger.error(
            `Maximum number of retries (${maxRetries}) reached. Failing permanently.`,
            error instanceof Error ? error.stack : error,
          );
          throw error;
        }

        // If retryableErrors are specified, check if the error is one of them
        if (retryableErrors && retryableErrors.length > 0) {
          const errorStr = error instanceof Error ? error.message : String(error);
          const shouldRetry = retryableErrors.some((pattern) => pattern.test(errorStr));
          
          if (!shouldRetry) {
            this.logger.warn(
              `Error is not in the retryable list. Throwing immediately.`,
              error instanceof Error ? error.stack : error,
            );
            throw error;
          }
        }

        // Calculate delay with exponential backoff and optional jitter
        let delayMs = initialDelayMs * Math.pow(factor, attempt - 1);
        if (jitter) {
          // Add a random jitter (e.g., +/- 20% of the delay)
          const jitterValue = delayMs * 0.4 * (Math.random() - 0.5);
          delayMs += jitterValue;
        }
        delayMs = Math.min(delayMs, maxDelayMs);

        this.logger.warn(
          `Attempt ${attempt} failed. Retrying in ${Math.round(delayMs)}ms...`,
          error instanceof Error ? error.stack : error,
        );
        
        await sleep(delayMs);
      }
    }
    throw new Error('Retry loop exited unexpectedly.');
  }
}