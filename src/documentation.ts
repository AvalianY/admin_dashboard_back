import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openapi } from "./openapi.js";

export function documentationRoutes() {
  const router = Router();
  router.get("/openapi.json", (_req, res) => {
    res.set("Cache-Control", "no-store").json(openapi);
  });
  router.use(swaggerUi.serve);
  router.get(
    "/",
    swaggerUi.setup(undefined, {
      customSiteTitle: "E-Pharmacy API Documentation",
      swaggerOptions: {
        url: "/api-docs/openapi.json",
        persistAuthorization: false,
        validatorUrl: null,
        deepLinking: true,
        displayRequestDuration: true,
        tryItOutEnabled: false,
      },
    }),
  );
  return router;
}
