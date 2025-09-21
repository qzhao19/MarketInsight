import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { type BaseMessage } from "@langchain/core/messages";

export type AnyRecord = Record<string, any>;

/**
 * Input state schema for the market research agent.
 * Maps the LLMInput structure to LangGraph's input state.
 */
export const InputStateAnnotation = Annotation.Root({

  /**
   * prompt text from the LLMInput
   */
  prompt: Annotation<string>,

  /**
   * Additional context information for the research
   */
  context: Annotation<AnyRecord>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),

  /**
   * Model parameters for LLM configuration
   */
  modelParameters: Annotation<AnyRecord>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});


export const StateAnnotation = Annotation.Root({
  
  /**
   * Messages track the primary execution state of the agent.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),


   /**
   * The original prompt text
   */
  prompt: Annotation<string>,
  
  /**
   * Additional context information
   */
  context: Annotation<AnyRecord>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  
  /**
   * Model parameters for LLM configuration
   */
  modelParameters: Annotation<AnyRecord>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),

  rawOutput: Annotation<string>(),

  /**
   * Processed structured output data
   */
  processedOutput: Annotation<AnyRecord>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}), 
  }),

  /**
   * Metadata about the generation process
   */
  metadata: Annotation<AnyRecord>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),

   /**
   * Tracks the number of iterations the agent has gone through in the current session.
   * This can be used to limit the number of iterations or to track progress.
   */
  loopStep: Annotation<number>({
    reducer: (left: number, right: number) => left + right,
    default: () => 0,
  }),

});
