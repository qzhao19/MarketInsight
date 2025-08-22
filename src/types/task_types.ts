/**
 * Defines the possible statuses of a task.
 */
export enum TaskStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

/**
 * Defines the structure for the input sent to the LLM.
 */
export interface LLMInput {
    prompt: string;
    context?: Record<string, any>;
    // Parameters for the LLM call, e.g., temperature, max_tokens
    modelParameters?: Record<string, any>;
}

/**
 * defines the structure for the result received from the LLM.
 */
export interface LLMResult {
    rawOutput: string;
    processedOutput?: Record<string, any> | string;
    // metadata from the LLM provider, e.g., token usage, model name
    metadata?: Record<string, any>;
}

/**
 * data structure for a task, corresponding to the table model in the database.
 */
export interface Task {
    id: string;
    status: TaskStatus;
    priority: number;
    input: LLMInput;
    result: LLMResult | null;
    error: string | null; // error message if the task fails.
    createdAt: Date;
    updatedAt: Date;
}

/**
 * API - request body for creating a task.
 */
export type CreateTaskRequest = {
    input: LLMInput;
    priority?: number;
};

/**
 * API - response body for a task returned to the client.
 */
export type TaskResponse = {
    id: string;
    status: TaskStatus;
    input: LLMInput;
    result: LLMResult | null;
    createdAt: Date;
    updatedAt: Date;
};
