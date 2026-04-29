import { describe, expect, test } from "bun:test";
import {
  getMissingModelProviderEnvVars,
  getOpenAIProviderOptions,
} from "../api/_utils/_aiModels.js";

describe("OpenAI provider options", () => {
  test("preserves explicit reasoning effort for gpt-5-mini", () => {
    expect(getOpenAIProviderOptions("gpt-5-mini")).toEqual({
      openai: {
        reasoningEffort: "minimal",
      },
    });
  });

  test("preserves explicit reasoning effort for gpt-5.4", () => {
    expect(getOpenAIProviderOptions("gpt-5.4")).toEqual({
      openai: {
        reasoningEffort: "minimal",
      },
    });
  });

  test("ignores OpenAI provider options for non-OpenAI models", () => {
    expect(getOpenAIProviderOptions("sonnet-4.6")).toBeUndefined();
  });

  test("reports missing OpenAI key for gpt-5.4 when unset", () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(getMissingModelProviderEnvVars("gpt-5.4")).toEqual([
      "OPENAI_API_KEY",
    ]);

    if (original) {
      process.env.OPENAI_API_KEY = original;
    }
  });

  test("reports missing OpenAI key for gpt-5-mini when unset", () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(getMissingModelProviderEnvVars("gpt-5-mini")).toEqual([
      "OPENAI_API_KEY",
    ]);

    if (original) {
      process.env.OPENAI_API_KEY = original;
    }
  });
});
