import { Injectable, Logger } from "@nestjs/common";
import { RetryConfig } from "../../../types/llm/client.types"

// Helper function for sleeping
const sleep = (ms: number) => 
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class RetryGuard {
  private readonly logger: Logger;
  private readonly defaultConfig: RetryConfig;

  constructor(defaultConfig: RetryConfig) {
    // Merge default config
    this.defaultConfig = defaultConfig;
    this.logger = new Logger(RetryGuard.name);
    this.logger.log(
      `Retry guard initialized with config:\n` +
      `  maxRetries=${this.defaultConfig.maxRetries},\n` +
      `  initialDelay=${this.defaultConfig.initialDelayMs}ms,\n` +
      `  maxDelay=${this.defaultConfig.maxDelayMs}ms,\n` +
      `  factor=${this.defaultConfig.factor},\n` +
      `  jitter=${this.defaultConfig.jitter}`
    );
  }

  public async exponentialBackoff<T>(
    func: () => Promise<T>,
  ): Promise<T> {
    const totalAttempts = this.defaultConfig.maxRetries + 1;
    for (let attempt = 1; attempt <= this.defaultConfig.maxRetries + 1; attempt++) {
      try {
        const startTime = Date.now();
        const result = await func();
        const duration = Date.now() - startTime;
        
        if (attempt > 1) {
          this.logger.log(
            `Retry successful on attempt ${attempt}/${totalAttempts} (${duration}ms)`
          );
        }
        
        return result;
      } catch (error) {
        // If this was the last attempt, throw the error
        if (attempt === totalAttempts) {
          this.logger.error(
            `All retry attempts exhausted (${totalAttempts} attempts).`,
            error instanceof Error ? error.stack : error,
          );
          throw error;
        }

        // If retryableErrors are specified, check if the error is one of them
        if (this.defaultConfig.retryableErrors && this.defaultConfig.retryableErrors.length > 0) {
          const errorStr = error instanceof Error ? error.message : String(error);
          const shouldRetry = this.defaultConfig.retryableErrors.some((pattern) => pattern.test(errorStr));
          
          if (!shouldRetry) {
            this.logger.warn(
              `Error is not in the retryable list. Throwing immediately.`,
              error instanceof Error ? error.stack : error,
            );
            throw error;
          }
        }

        // Calculate delay with exponential backoff and optional jitter
        let delayMs = this.defaultConfig.initialDelayMs * Math.pow(this.defaultConfig.factor, attempt - 1);
        if (this.defaultConfig.jitter) {
          // Add a random jitter (e.g., +/- 20% of the delay)
          const jitterValue = delayMs * 0.4 * (Math.random() - 0.5);
          delayMs += jitterValue;
        }
        delayMs = Math.min(delayMs, this.defaultConfig.maxDelayMs);

        this.logger.warn(
          `Attempt ${attempt} failed. Retrying in ${Math.round(delayMs)}ms...`,
          error instanceof Error ? error.stack : error,
        );
        
        await sleep(delayMs);
      }
    }
    throw new Error("Retry loop exited unexpectedly.");
  }
}