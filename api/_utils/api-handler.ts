import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Redis } from "./redis.js";
import { initLogger } from "./_logging.js";
import { getEffectiveOrigin, isAllowedOrigin, setCorsHeaders } from "./_cors.js";
import { createRedis } from "./redis.js";
import { resolveRequestAuth, type AuthenticatedRequestUser } from "./request-auth.js";
import { recordAnalyticsEvent } from "./_analytics.js";
import { getClientIp } from "./_rate-limit.js";

type AuthMode = "none" | "optional" | "required";

export interface ApiHandlerOptions {
  methods: string[];
  auth?: AuthMode;
  allowExpiredAuth?: boolean;
  parseJsonBody?: boolean;
  contentType?: string | null;
}

export interface ApiHandlerContext<TBody = unknown> {
  req: VercelRequest;
  res: VercelResponse;
  redis: Redis;
  logger: ReturnType<typeof initLogger>["logger"];
  startTime: number;
  origin: string | null;
  user: AuthenticatedRequestUser | null;
  body: TBody | null;
}

type WrappedApiHandler<TBody = unknown> = (
  context: ApiHandlerContext<TBody>
) => Promise<void | VercelResponse>;

function sendJsonError(
  res: VercelResponse,
  status: number,
  error: string
): void {
  res.status(status).json({ error });
}

function sendJsonPayload(
  res: VercelResponse,
  status: number,
  payload: Record<string, unknown>
): void {
  res.status(status).json(payload);
}

function isRedisConfigurationError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.message.includes("Missing Redis configuration") ||
      error.message.includes("REDIS_PROVIDER requests") ||
      error.message.includes("Missing REDIS_URL"))
  );
}

export function apiHandler<TBody = unknown>(
  options: ApiHandlerOptions,
  handler: WrappedApiHandler<TBody>
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  const {
    methods,
    auth = "none",
    allowExpiredAuth = false,
    parseJsonBody = false,
    contentType = "application/json",
  } = options;

  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const { logger } = initLogger();
    const startTime = Date.now();
    const origin = getEffectiveOrigin(req);
    const method = (req.method || "GET").toUpperCase();

    logger.request(method, req.url || "/api/unknown");

    if (method === "OPTIONS") {
      setCorsHeaders(res, origin, { methods: [...methods, "OPTIONS"] });
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      logger.response(204, Date.now() - startTime);
      res.status(204).end();
      return;
    }

    setCorsHeaders(res, origin, { methods: [...methods, "OPTIONS"] });
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    if (!isAllowedOrigin(origin)) {
      logger.response(403, Date.now() - startTime);
      sendJsonError(res, 403, "Unauthorized");
      return;
    }

    if (!methods.includes(method)) {
      logger.response(405, Date.now() - startTime);
      sendJsonError(res, 405, "Method not allowed");
      return;
    }

    let redis: Redis;
    try {
      redis = createRedis();
    } catch (error) {
      logger.error("Redis initialization error", error);
      const status = isRedisConfigurationError(error) ? 503 : 500;
      logger.response(status, Date.now() - startTime);

      if (isRedisConfigurationError(error)) {
        sendJsonPayload(res, status, {
          error: "service_unavailable",
          code: "redis_not_configured",
          message:
            "Redis is not configured for the API server.",
          details:
            "Set REDIS_URL for standard Redis or REDIS_KV_REST_API_URL plus REDIS_KV_REST_API_TOKEN for Upstash REST, then restart the API server.",
        });
        return;
      }

      sendJsonError(res, status, "Internal Server Error");
      return;
    }

    let body: TBody | null = null;
    if (parseJsonBody) {
      try {
        body = (req.body as TBody | undefined) ?? null;
      } catch {
        logger.response(400, Date.now() - startTime);
        sendJsonError(res, 400, "Invalid JSON body");
        return;
      }
    }

    let user: AuthenticatedRequestUser | null = null;
    if (auth !== "none") {
      const authResult = await resolveRequestAuth(req, redis, {
        required: auth === "required",
        allowExpired: allowExpiredAuth,
      });

      if (authResult.error) {
        logger.response(authResult.error.status, Date.now() - startTime);
        sendJsonError(res, authResult.error.status, authResult.error.error);
        return;
      }

      user = authResult.user;
    }

    let finalStatus = 200;
    try {
      await handler({
        req,
        res,
        redis,
        logger,
        startTime,
        origin,
        user,
        body,
      });
      finalStatus = res.statusCode ?? 200;
    } catch (error) {
      logger.error("Unhandled API handler error", error);
      logger.response(500, Date.now() - startTime);
      sendJsonError(res, 500, "Internal Server Error");
      finalStatus = 500;
    }

    recordAnalyticsEvent(redis, {
      path: req.url || "/api/unknown",
      method,
      status: finalStatus,
      latencyMs: Date.now() - startTime,
      ip: getClientIp(req),
      username: user?.username,
    });
  };
}
