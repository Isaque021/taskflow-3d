import { and, eq, ne, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { sessions, users } from "../db/schema";
import { normalizeEmail } from "../lib/utils";
import { publicUser, authenticate, requireAdmin, requireAuth } from "../lib/auth";
import { HttpError, validationError } from "../lib/errors";

const idSchema = z.object({ id: z.string().uuid() });

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "member"]).default("member"),
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    password: z.string().min(8).max(128).optional(),
    role: z.enum(["admin", "member"]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Informe pelo menos um campo para atualizar.",
  });

async function ensureNotLastAdmin(organizationId: string, targetId: string, nextRole: "admin" | "member", nextStatus: "active" | "inactive") {
  if (nextRole === "admin" && nextStatus === "active") return;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        eq(users.organizationId, organizationId),
        eq(users.role, "admin"),
        eq(users.status, "active"),
        ne(users.id, targetId),
      ),
    );

  if (!countRow || Number(countRow.count) === 0) {
    throw new HttpError(400, "A organização precisa manter pelo menos um administrador ativo.");
  }
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/api/users", { preHandler: authenticate }, async (request) => {
    const auth = requireAdmin(request);

    const records = await db
      .select()
      .from(users)
      .where(eq(users.organizationId, auth.organizationId))
      .orderBy(users.name);

    return { users: records.map(publicUser) };
  });

  app.get("/api/users/assignees", { preHandler: authenticate }, async (request) => {
    const auth = requireAuth(request);
    const records = await db
      .select({ id: users.id, name: users.name, status: users.status })
      .from(users)
      .where(and(eq(users.organizationId, auth.organizationId), eq(users.status, "active")))
      .orderBy(users.name);

    return { users: records };
  });

  app.post("/api/users", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAdmin(request);
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const email = normalizeEmail(parsed.data.email);
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return reply.code(409).send({ error: "Já existe um usuário com este e-mail." });

    const passwordHash = await Bun.password.hash(parsed.data.password);
    const [user] = await db
      .insert(users)
      .values({
        organizationId: auth.organizationId,
        name: parsed.data.name.trim(),
        email,
        passwordHash,
        role: parsed.data.role,
        status: "active",
      })
      .returning();

    if (!user) throw new Error("Não foi possível criar o usuário.");
    return reply.code(201).send({ user: publicUser(user) });
  });

  app.patch("/api/users/:id", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAdmin(request);
    const params = idSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const [current] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, params.data.id), eq(users.organizationId, auth.organizationId)))
      .limit(1);
    if (!current) return reply.code(404).send({ error: "Usuário não encontrado." });

    const nextRole = parsed.data.role ?? current.role;
    const nextStatus = parsed.data.status ?? current.status;
    if (current.id === auth.userId && nextStatus === "inactive") {
      return reply.code(400).send({ error: "Você não pode desativar sua própria conta." });
    }

    await ensureNotLastAdmin(auth.organizationId, current.id, nextRole, nextStatus);

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    };
    if (parsed.data.password) updates.passwordHash = await Bun.password.hash(parsed.data.password);

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(and(eq(users.id, current.id), eq(users.organizationId, auth.organizationId)))
      .returning();

    if (!updated) throw new Error("Não foi possível atualizar o usuário.");
    if (nextStatus === "inactive") {
      await db.delete(sessions).where(eq(sessions.userId, current.id));
    }

    return reply.send({ user: publicUser(updated) });
  });

  app.delete("/api/users/:id", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAdmin(request);
    const params = idSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    if (params.data.id === auth.userId) {
      return reply.code(400).send({ error: "Você não pode desativar sua própria conta." });
    }

    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, params.data.id), eq(users.organizationId, auth.organizationId)))
      .limit(1);
    if (!target) return reply.code(404).send({ error: "Usuário não encontrado." });
    if (target.status === "inactive") return reply.code(204).send();

    await ensureNotLastAdmin(auth.organizationId, target.id, target.role, "inactive");
    await db
      .update(users)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(users.id, target.id), eq(users.organizationId, auth.organizationId)));
    await db.delete(sessions).where(eq(sessions.userId, target.id));

    return reply.code(204).send();
  });
}
