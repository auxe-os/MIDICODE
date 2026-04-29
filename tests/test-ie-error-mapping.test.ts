import { describe, expect, test } from "bun:test";
import {
  buildInternetExplorerErrorFromResponse,
  buildInternetExplorerErrorFromThrownError,
} from "../src/apps/internet-explorer/utils/errorMapping";

describe("internet explorer error mapping", () => {
  test("maps redis configuration responses to actionable setup guidance", async () => {
    const response = new Response(
      JSON.stringify({
        error: "service_unavailable",
        code: "redis_not_configured",
        message: "Redis is required",
        details: "Set REDIS_URL",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const mapped = await buildInternetExplorerErrorFromResponse(
      response,
      "https://example.com",
      {
        type: "service_unavailable",
        message: "fallback",
      }
    );

    expect(mapped.type).toBe("service_configuration_error");
    expect(mapped.message).toContain("Redis");
    expect(mapped.details).toContain("REDIS_URL");
  });

  test("maps missing AI provider keys from thrown errors", () => {
    const mapped = buildInternetExplorerErrorFromThrownError(
      new Error("OPENAI_API_KEY is missing"),
      "https://example.com",
      {
        type: "ai_generation_error",
        message: "fallback",
      }
    );

    expect(mapped.type).toBe("service_configuration_error");
    expect(mapped.message).toContain("AI website generation");
    expect(mapped.details).toContain("OPENAI_API_KEY");
  });
});
