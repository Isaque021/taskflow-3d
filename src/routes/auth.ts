import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { licenses, organizations, users } from "../db/schema";
import {
  authenticate,
  createSession,
  destroySession,
  publicUser,
  requireAuth,
  setSessionCookie,
} from "../lib/auth";
import { validationError } from "../lib/errors";
import { normalizeEmail, slugify } from "../lib/utils";

const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const email = normalizeEmail(parsed.data.email);
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
      return reply.code(409).send({ error: "Já existe um usuário com este e-mail." });
    }

    const passwordHash = await Bun.password.hash(parsed.data.password);
    const slug = `${slugify(parsed.data.organizationName)}-${crypto.randomUUID().slice(0, 8)}`;

    const result = await db.transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values({ name: parsed.data.organizationName.trim(), slug })
        .returning();

      if (!organization) throw new Error("Não foi possível criar a organização.");

      await tx.insert(licenses).values({ organizationId: organization.id });

      const [user] = await tx
        .insert(users)
        .values({
          organizationId: organization.id,
          name: parsed.data.name.trim(),
          email,
          passwordHash,
          role: "admin",
          status: "active",
        })
        .returning();

      if (!user) throw new Error("Não foi possível criar o administrador.");
      return { organization, user };
    });

    const session = await createSession(result.user.id);
    setSessionCookie(reply, session.token, session.expiresAt);

    return reply.code(201).send({
      user: publicUser(result.user),
      organization: result.organization,
    });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const email = normalizeEmail(parsed.data.email);
    const [record] = await db
      .select({
        user: users,
        organization: organizations,
        licenseStatus: licenses.status,
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .innerJoin(licenses, eq(licenses.organizationId, organizations.id))
      .where(and(eq(users.email, email), eq(users.status, "active")))
      .limit(1);

    if (!record || !(await Bun.password.verify(parsed.data.password, record.user.passwordHash))) {
      return reply.code(401).send({ error: "E-mail ou senha inválidos." });
    }

    if (record.licenseStatus !== "active") {
      return reply.code(403).send({ error: "A licença da organização está suspensa." });
    }

    const session = await createSession(record.user.id);
    setSessionCookie(reply, session.token, session.expiresAt);

    return reply.send({
      user: publicUser(record.user),
      organization: record.organization,
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await destroySession(request);
    reply.clearCookie("taskflow_session", { path: "/" });
    return reply.code(204).send();
  });

  app.get("/api/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const [record] = await db
      .select({ user: users, organization: organizations })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(and(eq(users.id, auth.userId), eq(users.organizationId, auth.organizationId)))
      .limit(1);

    if (!record) return reply.code(401).send({ error: "Sessão inválida." });

    return reply.send({
      user: publicUser(record.user),
      organization: record.organization,
    });
  });
}
