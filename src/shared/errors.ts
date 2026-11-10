import type { ErrorRequestHandler, Request, RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, _res, next) =>
  next(new ApiError(404, "NOT_FOUND", "Resource not found"));

export function requestParsingError(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("status" in error))
    return error;
  switch (error.status) {
    case 400:
      return "type" in error && error.type === "entity.parse.failed"
        ? new ApiError(400, "INVALID_JSON", "Invalid JSON body")
        : new ApiError(400, "INVALID_REQUEST_BODY", "Invalid request body");
    case 413:
      return new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
    case 415:
      return new ApiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Unsupported request body format",
      );
    default:
      return error;
  }
}

function logUnexpectedError(error: unknown, req: Request) {
  try {
    const base =
      /^\/api\/(?:user|products|suppliers|customers|orders|dashboard)(?=\/|\?|$)/i
        .exec(req.originalUrl)?.[0].toLowerCase();
    const suffix =
      typeof req.route?.path === "string" && req.route.path !== "/"
        ? req.route.path
        : "";
    console.error(
      JSON.stringify({
        event: "http_request_failed",
        method: /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(req.method)
          ? req.method
          : "OTHER",
        route: base ? `${base}${suffix}` : "unmatched",
        status: 500,
        errorCategory:
          error instanceof mongoose.Error || error instanceof mongoose.mongo.MongoError
            ? "database"
            : error instanceof Error
              ? "application"
              : "unknown",
      }),
    );
  } catch {
    // Diagnostics must not prevent the sanitized HTTP response.
  }
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  _next,
) => {
  if (error instanceof ZodError) {
    res
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
  } else if (error instanceof ApiError) {
    if (error.status === 401)
      res.set("WWW-Authenticate", 'Bearer realm="e-pharmacy"');
    res
      .status(error.status)
      .json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
  } else if (
    error instanceof mongoose.Error.ValidationError ||
    error instanceof mongoose.Error.CastError
  ) {
    res
      .status(400)
      .json({
        error: { code: "VALIDATION_ERROR", message: "Invalid record data" },
      });
  } else {
    logUnexpectedError(error, req);
    res
      .status(500)
      .json({
        error: { code: "INTERNAL_ERROR", message: "Unexpected server failure" },
      });
  }
};
