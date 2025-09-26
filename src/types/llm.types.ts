import { OpenAI as OpenAIClient } from "openai";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";

type ResponsesTool = NonNullable<
  OpenAIClient.Responses.ResponseCreateParams["tools"]
>[number];

export type ChatOpenAIToolType =
  | BindToolsInput
  | OpenAIClient.Chat.ChatCompletionTool
  | ResponsesTool;

export interface MacroAnalysis {
  marketSize: string;
  growthRates: string;
  forecasts: string;
  marketStage: string;
  macroEconomie: string,
  policies: string
};

export interface SegmentationAnalysis {
  productSegments: string;
  userSegments: any;
  geographicSegments: any;
};

export interface TrendAnalysis {
  technology: any;
  policy: any;
  socioeconomic: any;
  supplyChain: any;
  competitor: string
};



