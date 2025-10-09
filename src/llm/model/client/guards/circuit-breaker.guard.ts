import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { CircuitBreakerConfig } from "../../../../types/llm/client.types"
import { toOpossumOptions } from "../../../../utils/llm.utils"
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
      `Circuit breaker guard initialized with config: ` +
      `resetTimeout=${this.defaultConfig.resetTimeout}, ` +
      `timeout=${this.defaultConfig.timeout}, ` +
      `errorThresholdPercentage=${this.defaultConfig.errorThresholdPercentage}, ` +
      `rollingCountTimeout=${this.defaultConfig.rollingCountTimeout}, ` +
      `volumeThreshold=${this.defaultConfig.volumeThreshold}, ` +
      `capacity=${this.defaultConfig.capacity}, ` +
      `name=${this.defaultConfig.name}`
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
    // Check if a breaker with this name already exists
    const existingBreaker = this.breakers.get(name);
    if (existingBreaker) {
      this.logger.debug(
        `Reusing existing circuit breaker "${name}". ` +
        `Note: Any new func/fallback/options will be ignored.`
      );
      return existingBreaker;
    }

    // If not, create a new breaker
    const opossumOptions = toOpossumOptions(this.defaultConfig);
    const breaker = new CircuitBreaker(func, opossumOptions);

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