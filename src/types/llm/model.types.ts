/**
 * LLModelConfig defines the configuration options for a Large Language Model (LLM).
 * 
 * Properties:
 * - model: The model name or identifier (required).
 * - temperature: Controls randomness in generation. Lower values make output more deterministic.
 * - topP: Nucleus sampling parameter for diversity (0-1).
 * - frequencyPenalty: Penalizes repeated tokens based on frequency.
 * - presencePenalty: Penalizes repeated topics or ideas.
 * - maxTokens: Maximum number of tokens to generate in the output.
 * - maxConcurrency: Maximum number of concurrent requests allowed.
 * - maxRetries: Maximum number of retry attempts for failed requests.
 * - timeout: Request timeout in milliseconds.
 * - streaming: Whether to enable streaming responses (1 for true, 0 for false).
 * - verbose: Whether to enable verbose logging (1 for true, 0 for false).
 */
export interface LLModelConfig {
    model?: string,
    temperature?: number,
    topP?: number,
    frequencyPenalty?: number,
    presencePenalty?: number,
    maxTokens?: number,
    maxConcurrency?: number,
    maxRetries?: number,
    timeout?: number,
    streaming?: number,
    verbose?: number,
}