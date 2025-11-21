import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { CircuitBreakerConfig } from "../../../types/llm/client.types"
import { toOpossumOptions } from "../../../utils/llm.utils"
import CircuitBreaker from "opossum";

// Define a more specific type for the function passed to the breaker onApplicationShutdown
type BreakerAction<T extends any[], R> = (...args: T) => Promise<R>;

@Injectable()
export class CircuitBreakerGuard implements OnApplicationShutdown {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();
  private readonly defaultConfig: CircuitBreakerConfig;
  private readonly logger: Logger;

  // Inject Logger and allow for global default options
  constructor(defaultConfig: CircuitBreakerConfig) {
    this.defaultConfig = defaultConfig;
    this.logger = new Logger(CircuitBreakerGuard.name);
    this.logger.log(
      `\n` +
      `════════════════════════════════════════════════════════════════\n` +
      `                Circuit Breaker Configuration                   \n` +
      `════════════════════════════════════════════════════════════════\n` +
      `  Name:                 ${this.defaultConfig.name}\n` +
      `  Timeout:              ${this.defaultConfig.timeout}ms\n` +
      `  Reset Timeout:        ${this.defaultConfig.resetTimeout}ms\n` +
      `  Error Threshold:      ${this.defaultConfig.errorThresholdPercentage}%\n` +
      `  Rolling Count:        ${this.defaultConfig.rollingCountTimeout}ms\n` +
      `  Volume Threshold:     ${this.defaultConfig.volumeThreshold}\n` +
      `  Capacity:             ${this.defaultConfig.capacity}\n` +
      `════════════════════════════════════════════════════════════════\n`
    );
  }

  /**
   * Atomically gets an existing breaker or creates a new one.
   * This prevents race conditions where multiple breakers for 
   * the same name could be created.
   * @param name - The unique name for the circuit breaker.
   * @param func - The function to wrap in the circuit breaker.
   * @returns The existing or newly created CircuitBreaker instance.
   */
  public getOrCreateBreaker<T extends any[], R>(
    name: string,
    func: BreakerAction<T, R>,
    fallbackFunc?: (...args: any[]) => any,
  ): CircuitBreaker {
    if (!name || name.trim().length === 0) {
      throw new Error("Circuit breaker name cannot be empty");
    }

    // Check if a breaker with this name already exists
    const existingBreaker = this.breakers.get(name);
    if (existingBreaker) {
      if (fallbackFunc) {
        this.logger.warn(
          `Circuit breaker "${name}" already exists. ` +
          `New fallback function will be ignored. ` +
          `Consider using a different name if you need different behavior.`
        );
      }
      this.logger.debug(`Reusing existing circuit breaker "${name}".`);
      return existingBreaker;
    }

    try {
      // If not, create a new breaker
      const opossumOptions = toOpossumOptions(this.defaultConfig);
      const breaker = new CircuitBreaker(func, opossumOptions);

      // Set fallback function only one time
      if (fallbackFunc) {
        breaker.fallback(fallbackFunc);
        this.logger.debug(`Fallback function registered for circuit breaker "${name}".`);
      }

      // Add event listeners for logging
      this.setupEventListeners(breaker, name);

      // Store the new breaker
      this.breakers.set(name, breaker);
      this.logger.log(`New circuit breaker created: ${name}`);
      
      return breaker;
    } catch (error) {
      const errorMsg = `Failed to create circuit breaker "${name}": ${ error instanceof Error ? error.message : String(error) }`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  public getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Check if a circuit breaker exists
   */
  public hasBreaker(name: string): boolean {
    return this.breakers.has(name);
  }

  /**
   * Get all circuit breaker names
   */
  public getAllBreakerNames(): string[] {
    return Array.from(this.breakers.keys());
  }

  /**
   * Get circuit breaker statistics
   */
  public getBreakerStats(name: string): CircuitBreaker.Stats | undefined {
    const breaker = this.breakers.get(name);
    return breaker?.stats;
  }

  /**
   * Manually open a circuit breaker
   */
  public openBreaker(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.open();
      this.logger.log(`Circuit breaker "${name}" manually opened.`);
    } else {
      this.logger.warn(`Cannot open circuit breaker "${name}": not found.`);
    }
  }

  /**
   * Manually close a circuit breaker
   */
  public closeBreaker(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.close();
      this.logger.log(`Circuit breaker "${name}" manually closed.`);
    } else {
      this.logger.warn(`Cannot close circuit breaker "${name}": not found.`);
    }
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
    breaker.on("success", () => this.logger.debug(`Circuit Breaker "${name}" successful call.`));
    breaker.on("timeout", () => this.logger.warn(`Circuit Breaker "${name}" call timed out.`));
    breaker.on("reject", () => this.logger.warn(`Circuit Breaker "${name}" rejected call (circuit is open).`));
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

    // Clear the map
    this.breakers.clear();
  }
}