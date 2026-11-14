import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { AppConfig } from "./config.js";
import {
  ApiError,
  errorHandler,
  notFound,
  requestParsingError,
} from "./shared/errors.js";
import { authRoutes } from "./modules/auth/routes.js";
import { requireAuth, requireBusinessAccess } from "./modules/auth/service.js";
import { productRoutes } from "./modules/products/routes.js";
import { supplierRoutes } from "./modules/suppliers/routes.js";
import { customerRoutes } from "./modules/customers/routes.js";
import { orderRoutes } from "./modules/orders/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { documentationRoutes } from "./documentation.js";

export function createApp(
  config: AppConfig,
  clock: () => Date = () => new Date(),
) {
  const app = express();
  app.disable("x-powered-by");
  app.locals.clock = clock;
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.corsOrigins.includes(origin))
          callback(null, true);
        else
          callback(
            new ApiError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed"),
          );
      },
    }),
  );
  const parseJson = express.json();
  app.use((req, res, next) => {
    parseJson(req, res, (error: unknown) => next(requestParsingError(error)));
  });
  app.use("/api-docs", documentationRoutes());
  app.use("/api/user", authRoutes(config, clock));
  app.use(
    "/api/products",
    requireAuth(config.jwtSecret, clock),
    requireBusinessAccess,
    productRoutes(clock),
  );
  app.use(
    "/api/suppliers",
    requireAuth(config.jwtSecret, clock),
    requireBusinessAccess,
    supplierRoutes(clock),
  );
  app.use(
    "/api/customers",
    requireAuth(config.jwtSecret, clock),
    requireBusinessAccess,
    customerRoutes(clock),
  );
  app.use(
    "/api/orders",
    requireAuth(config.jwtSecret, clock),
    requireBusinessAccess,
    orderRoutes(),
  );
  app.use(
    "/api/dashboard",
    requireAuth(config.jwtSecret, clock),
    requireBusinessAccess,
    dashboardRoutes(clock),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
