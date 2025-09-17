import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import CircuitBreaker from "opossum";

// Define a more specific type for the function passed to the breaker onApplicationShutdown
type BreakerAction<T extends any[], R> = (...args: T) => Promise<R>;

@Injectable()
export class CircuitBreakerGuard implements OnApplicationShutdown {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();
  private readonly defaultOptions: CircuitBreaker.Options;
  private readonly logger: Logger;

  // Inject Logger and allow for global default options
  constructor() {
    this.defaultOptions = {
      resetTimeout: 30000, // 30 seconds before trying to half-open
      timeout: 100000, // 100 seconds timeout is considered a failure
      errorThresholdPercentage: 50,
      rollingCountTimeout: 60000, // 1-minute statistics window
    };
    this.logger = new Logger(CircuitBreakerGuard.name);
    this.logger.log("CircuitBreakerGuard initialized.");
  }

  /**
   * Atomically gets an existing breaker or creates a new one.
   * This prevents race conditions where multiple breakers for 
   * the same name could be created.
   * @param name - The unique name for the circuit breaker.
   * @param func - The function to wrap in the circuit breaker.
   * @param options - Opossum options to override the defaults.
   * @returns The existing or newly created CircuitBreaker instance.
   */
  public getOrCreateBreaker<T extends any[], R>(
    name: string,
    func: BreakerAction<T, R>,
    options: CircuitBreaker.Options = {},
    fallbackFunc?: (...args: any[]) => any,
  ): CircuitBreaker {
    // Check if a breaker with this name already exists
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    // If not, create a new one
    const mergedOptions = { ...this.defaultOptions, ...options, name };
    const breaker = new CircuitBreaker(func, mergedOptions);

    // Set fallback function only one time
    if (fallbackFunc) {
      breaker.fallback(fallbackFunc);
    }

    // Add event listeners for logging
    this.setupEventListeners(breaker, name);

    // Store the new breaker
    this.breakers.set(name, breaker);
    this.logger.log(`New circuit breaker created: ${name}`);
    return breaker;
  }

  /**
   * Centralized event listener setup.
   */
  private setupEventListeners(breaker: CircuitBreaker, name: string): void {
    breaker.on("open", () => this.logger.warn(`Circuit Breaker "${name}" has opened.`));
    breaker.on("halfOpen", () => this.logger.log(`Circuit Breaker "${name}" is half-open.`));
    breaker.on("close", () => this.logger.log(`Circuit Breaker "${name}" has closed.`));
    breaker.on("fallback", (data) => this.logger.warn(`Circuit Breaker "${name}" fallback executed.`, data));
    breaker.on("failure", (error) => this.logger.error(`Circuit Breaker "${name}" recorded a failure.`, error.stack));
  }

  /**
   * Gracefully shuts down all breakers on application shutdown.
   */
  onApplicationShutdown(signal?: string): void {
    this.logger.log(`Shutting down all circuit breakers due to ${signal || "application shutdown"}...`);
    this.breakers.forEach((breaker, name) => {
      if (!breaker.isShutdown) {
        breaker.shutdown();
        this.logger.log(`Circuit breaker "${name}" has been shut down.`);
      }
    });
  }
}