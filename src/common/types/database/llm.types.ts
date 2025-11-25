// ==================== LLM Related Types ====================

// Defines the structure for the input sent to the LLM.
export interface LLMInput {
  prompt: string;
  context?: Record<string, any>;
  // Parameters for the LLM call, e.g., temperature, max_tokens
  modelParameters?: Record<string, any>;
};

// Defines the structure for the result received from the LLM.
export interface LLMResult {
  rawOutput: string;
  processedOutput?: Record<string, any> | string;
  // metadata from the LLM provider, e.g., token usage, model name
  metadata?: Record<string, any>;
};