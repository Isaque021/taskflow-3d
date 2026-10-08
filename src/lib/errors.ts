import type { FastifyReply } from "fastify";
import type { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function validationError(reply: FastifyReply, error: ZodError) {
  return reply.code(400).send({
    error: "Dados inválidos.",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}
