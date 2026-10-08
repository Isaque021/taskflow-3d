import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { authRoutes } from "./routes/auth";
import { taskRoutes } from "./routes/tasks";
import { userRoutes } from "./routes/users";
import { HttpError } from "./lib/errors";

export function buildApp() {
  const app = Fastify({ logger: true });
  app.decorateRequest("auth", null);

  app.register(cookie);
  app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });

  app.get("/api/health", async () => ({ status: "ok" }));
  app.register(authRoutes);
  app.register(userRoutes);
  app.register(taskRoutes);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message, details: error.details });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "Ocorreu um erro interno." });
  });

  return app;
}

export async function start() {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });
}

if (import.meta.main) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
