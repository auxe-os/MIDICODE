import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// ============================================================================
// AI Model Types and Constants (duplicated from src/types/aiModels.ts)
// This avoids cross-directory imports that slow down vite-plugin-vercel
// ============================================================================

// Single source of truth for AI models
export const AI_MODELS = {
  "sonnet-4.6": { name: "sonnet-4.6", provider: "Anthropic" },
  "gpt-5-mini": { name: "gpt-5-mini", provider: "OpenAI" },
  "gpt-5.4": { name: "gpt-5.4", provider: "OpenAI" },
  "gemini-3-flash": { name: "gemini-3-flash", provider: "Google" },
  "gemini-3.1-pro-preview": { name: "gemini-3.1-pro-preview", provider: "Google" },
} as const;

// Derived types
export type SupportedModel = keyof typeof AI_MODELS;

// Derived arrays - exported for validation
export const SUPPORTED_AI_MODELS = Object.keys(AI_MODELS) as SupportedModel[];

// Default model
export const DEFAULT_MODEL: SupportedModel = "gpt-5-mini";
export const TELEGRAM_DEFAULT_MODEL: SupportedModel = DEFAULT_MODEL;

export function getModelProvider(model: SupportedModel): string {
  return AI_MODELS[model].provider;
}

export function getMissingModelProviderEnvVars(
  model: SupportedModel
): string[] {
  switch (AI_MODELS[model].provider) {
    case "OpenAI":
      return process.env.OPENAI_API_KEY?.trim() ? [] : ["OPENAI_API_KEY"];
    case "Anthropic":
      return process.env.ANTHROPIC_API_KEY?.trim()
        ? []
        : ["ANTHROPIC_API_KEY"];
    case "Google": {
      const hasGoogleKey =
        process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
        process.env.GOOGLE_AI_API_KEY?.trim();
      return hasGoogleKey
        ? []
        : ["GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_API_KEY"];
    }
    default:
      return [];
  }
}

type OpenAIReasoningEffort = "minimal" | "low" | "medium" | "high";

const OPENAI_REASONING_EFFORT_BY_MODEL: Partial<
  Record<SupportedModel, OpenAIReasoningEffort>
> = {
  "gpt-5-mini": "minimal",
  "gpt-5.4": "minimal",
};

// Factory that returns a LanguageModel instance for the requested model
export const getModelInstance = (model: SupportedModel): LanguageModel => {
  const modelToUse: SupportedModel = model ?? DEFAULT_MODEL;

  switch (modelToUse) {
    case "sonnet-4.6":
      return anthropic("claude-sonnet-4-6");
    case "gpt-5-mini":
      return openai("gpt-5-mini");
    case "gpt-5.4":
      return openai("gpt-5.4");
    case "gemini-3-flash":
      return google("gemini-3-flash-preview");
    case "gemini-3.1-pro-preview":
      return google("gemini-3.1-pro-preview");
    default:
      return openai("gpt-5-mini");
  }
};

export function getOpenAIProviderOptions(
  model: SupportedModel
): { openai: { reasoningEffort?: OpenAIReasoningEffort } } | undefined {
  if (AI_MODELS[model].provider !== "OpenAI") {
    return undefined;
  }

  const openaiOptions: {
    reasoningEffort?: OpenAIReasoningEffort;
  } = {};

  const reasoningEffort = OPENAI_REASONING_EFFORT_BY_MODEL[model];
  if (reasoningEffort) {
    openaiOptions.reasoningEffort = reasoningEffort;
  }

  if (Object.keys(openaiOptions).length === 0) {
    return undefined;
  }

  return {
    openai: openaiOptions,
  };
}
