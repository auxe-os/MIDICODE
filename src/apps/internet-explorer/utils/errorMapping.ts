import type { ErrorResponse } from "@/stores/useInternetExplorerStore";

type ApiDiagnosticPayload = {
  error?: unknown;
  code?: unknown;
  message?: unknown;
  details?: unknown;
  status?: unknown;
  provider?: unknown;
  missingEnvVars?: unknown;
};

const REDIS_DETAILS =
  "Set REDIS_URL for standard Redis or REDIS_KV_REST_API_URL plus REDIS_KV_REST_API_TOKEN for Upstash REST, then restart the API server.";

const API_DETAILS =
  "Start the full stack with `bun run dev` so `/api/*` routes are available to Internet Explorer.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePayload(raw: unknown): ApiDiagnosticPayload | null {
  if (!isRecord(raw)) return null;
  return raw as ApiDiagnosticPayload;
}

function payloadText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function payloadStatus(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function payloadEnvVars(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function mapKnownDiagnostic(
  payload: ApiDiagnosticPayload,
  targetUrl: string,
  fallbackStatus?: number
): ErrorResponse | null {
  const code = payloadText(payload.code);
  const provider = payloadText(payload.provider);
  const status = payloadStatus(payload.status) ?? fallbackStatus;
  const missingEnvVars = payloadEnvVars(payload.missingEnvVars);
  const details = payloadText(payload.details);

  if (code === "redis_not_configured") {
    return {
      error: true,
      type: "service_configuration_error",
      status: status ?? 503,
      message:
        "Internet Explorer time travel is unavailable because Redis is not configured.",
      details: details || REDIS_DETAILS,
      targetUrl,
    };
  }

  if (code === "ai_provider_not_configured") {
    const envHint =
      missingEnvVars.length > 0
        ? ` Set ${missingEnvVars.join(" or ")} and restart the API server.`
        : "";
    return {
      error: true,
      type: "service_configuration_error",
      status: status ?? 503,
      message: `AI website generation is unavailable because the ${
        provider || "selected"
      } provider is not configured.`,
      details:
        details ||
        `Configure the API key for the selected model before using past pre-1996 or future years.${envHint}`,
      targetUrl,
    };
  }

  if (code === "api_unavailable") {
    return {
      error: true,
      type: "service_unavailable",
      status: status ?? 503,
      message:
        "Internet Explorer cannot reach the local API service it needs for navigation.",
      details: details || API_DETAILS,
      targetUrl,
    };
  }

  return null;
}

function parseTextPayload(text: string): ApiDiagnosticPayload | null {
  try {
    return normalizePayload(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function buildInternetExplorerErrorFromResponse(
  response: Response,
  targetUrl: string,
  fallback: {
    type: ErrorResponse["type"];
    message: string;
    details?: string;
  }
): Promise<ErrorResponse> {
  let payload: ApiDiagnosticPayload | null = null;
  let rawText: string | null = null;

  const contentType = response.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      payload = normalizePayload(await response.json());
    } else {
      rawText = await response.text();
      payload = parseTextPayload(rawText);
    }
  } catch {
    // Fall through to generic handling below.
  }

  const mapped = payload
    ? mapKnownDiagnostic(payload, targetUrl, response.status)
    : null;
  if (mapped) return mapped;

  return {
    error: true,
    type: fallback.type,
    status: response.status,
    message: fallback.message,
    details:
      payloadText(payload?.message) ||
      payloadText(payload?.details) ||
      rawText ||
      fallback.details ||
      `HTTP ${response.status}: ${response.statusText || "Request failed"}`,
    targetUrl,
  };
}

export function buildInternetExplorerErrorFromThrownError(
  error: unknown,
  targetUrl: string,
  fallback: {
    type: ErrorResponse["type"];
    message: string;
    details?: string;
  }
): ErrorResponse {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (
    message.includes("OPENAI_API_KEY") ||
    message.includes("ANTHROPIC_API_KEY") ||
    message.includes("GOOGLE_GENERATIVE_AI_API_KEY") ||
    message.includes("GOOGLE_AI_API_KEY")
  ) {
    return {
      error: true,
      type: "service_configuration_error",
      status: 503,
      message:
        "AI website generation is unavailable because the selected AI provider is not configured.",
      details: message,
      targetUrl,
    };
  }

  if (message.includes("Missing Redis configuration")) {
    return {
      error: true,
      type: "service_configuration_error",
      status: 503,
      message:
        "Internet Explorer time travel is unavailable because Redis is not configured.",
      details: REDIS_DETAILS,
      targetUrl,
    };
  }

  if (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Load failed")
  ) {
    return {
      error: true,
      type: "service_unavailable",
      status: 503,
      message:
        "Internet Explorer cannot reach the local API service it needs for navigation.",
      details: API_DETAILS,
      targetUrl,
    };
  }

  return {
    error: true,
    type: fallback.type,
    status: 500,
    message: fallback.message,
    details: message || fallback.details,
    targetUrl,
  };
}
