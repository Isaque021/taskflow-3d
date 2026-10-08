import { and, asc, eq, lt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { subtasks, tasks, users } from "../db/schema";
import { authenticate, requireAuth } from "../lib/auth";
import { HttpError, validationError } from "../lib/errors";
import { parseDate } from "../lib/utils";

const taskCategories = ["market", "car", "work"] as const;
const idSchema = z.object({ id: z.string().uuid() });
const taskIdSchema = z.object({ taskId: z.string().uuid() });
const subtaskParamsSchema = z.object({ taskId: z.string().uuid(), subtaskId: z.string().uuid() });

const taskCreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(5000).nullable().optional(),
  responsibleUserId: z.string().uuid().nullable().optional(),
  dueAt: z.string().min(1),
  category: z.enum(taskCategories),
});

const taskUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().max(5000).nullable().optional(),
    responsibleUserId: z.string().uuid().nullable().optional(),
    dueAt: z.string().min(1).optional(),
    category: z.enum(taskCategories).optional(),
    completed: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Informe pelo menos um campo para atualizar.",
  });

const subtaskCreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  sortOrder: z.number().int().min(0).optional(),
});

const subtaskUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    completed: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Informe pelo menos um campo para atualizar.",
  });

async function ensureResponsible(organizationId: string, responsibleUserId: string | null | undefined) {
  if (!responsibleUserId) return;

  const [responsible] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, responsibleUserId),
        eq(users.organizationId, organizationId),
        eq(users.status, "active"),
      ),
    )
    .limit(1);

  if (!responsible) {
    throw new HttpError(400, "O responsável precisa ser um usuário ativo da organização.");
  }
}

async function findTask(organizationId: string, taskId: string) {
  const [task] = await db
    .select({
      id: tasks.id,
      organizationId: tasks.organizationId,
      createdBy: tasks.createdBy,
      responsibleUserId: tasks.responsibleUserId,
      responsibleName: users.name,
      name: tasks.name,
      description: tasks.description,
      category: tasks.category,
      dueAt: tasks.dueAt,
      completed: tasks.completed,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(users, and(eq(tasks.responsibleUserId, users.id), eq(tasks.organizationId, users.organizationId)))
    .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
    .limit(1);

  return task;
}

async function findSubtasks(organizationId: string, taskId: string) {
  return db
    .select()
    .from(subtasks)
    .where(and(eq(subtasks.organizationId, organizationId), eq(subtasks.taskId, taskId)))
    .orderBy(asc(subtasks.sortOrder), asc(subtasks.createdAt));
}

function serializeTask(task: NonNullable<Awaited<ReturnType<typeof findTask>>>) {
  return {
    ...task,
    responsible: task.responsibleUserId
      ? { id: task.responsibleUserId, name: task.responsibleName }
      : null,
    overdue: !task.completed && task.dueAt.getTime() < Date.now(),
  };
}

export async function taskRoutes(app: FastifyInstance) {
  app.get("/api/tasks", { preHandler: authenticate }, async (request) => {
    const auth = requireAuth(request);
    const query = request.query as { status?: string; category?: string };
    const conditions = [eq(tasks.organizationId, auth.organizationId)];

    if (query.status === "pending") conditions.push(eq(tasks.completed, false));
    if (query.status === "completed") conditions.push(eq(tasks.completed, true));
    if (query.status === "overdue") {
      conditions.push(eq(tasks.completed, false), lt(tasks.dueAt, new Date()));
    }
    if (taskCategories.includes(query.category as (typeof taskCategories)[number])) {
      conditions.push(eq(tasks.category, query.category as (typeof taskCategories)[number]));
    }

    const records = await db
      .select({
        id: tasks.id,
        organizationId: tasks.organizationId,
        createdBy: tasks.createdBy,
        responsibleUserId: tasks.responsibleUserId,
        responsibleName: users.name,
        name: tasks.name,
        description: tasks.description,
        category: tasks.category,
        dueAt: tasks.dueAt,
        completed: tasks.completed,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .leftJoin(users, and(eq(tasks.responsibleUserId, users.id), eq(tasks.organizationId, users.organizationId)))
      .where(and(...conditions))
      .orderBy(asc(tasks.completed), asc(tasks.dueAt));

    const taskIds = records.map((task) => task.id);
    const subtaskRecords = taskIds.length
      ? await db
          .select({ taskId: subtasks.taskId, completed: subtasks.completed })
          .from(subtasks)
          .where(eq(subtasks.organizationId, auth.organizationId))
      : [];
    const subtaskCounts = new Map<string, { total: number; completed: number }>();

    for (const subtask of subtaskRecords) {
      const count = subtaskCounts.get(subtask.taskId) ?? { total: 0, completed: 0 };
      count.total += 1;
      if (subtask.completed) count.completed += 1;
      subtaskCounts.set(subtask.taskId, count);
    }

    return {
      tasks: records.map((task) => ({
        ...serializeTask(task),
        subtasks: subtaskCounts.get(task.id) ?? { total: 0, completed: 0 },
      })),
    };
  });

  app.post("/api/tasks", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const parsed = taskCreateSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const dueAt = parseDate(parsed.data.dueAt);
    if (!dueAt) return reply.code(400).send({ error: "A data de vencimento é inválida." });
    await ensureResponsible(auth.organizationId, parsed.data.responsibleUserId);

    const [task] = await db
      .insert(tasks)
      .values({
        organizationId: auth.organizationId,
        createdBy: auth.userId,
        responsibleUserId: parsed.data.responsibleUserId ?? null,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        category: parsed.data.category,
        dueAt,
        completed: false,
        completedAt: null,
      })
      .returning();

    if (!task) throw new Error("Não foi possível criar a tarefa.");
    const created = await findTask(auth.organizationId, task.id);
    if (!created) throw new Error("Não foi possível carregar a tarefa criada.");

    return reply.code(201).send({ task: serializeTask(created) });
  });

  app.get("/api/tasks/:id", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const params = idSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);

    const task = await findTask(auth.organizationId, params.data.id);
    if (!task) return reply.code(404).send({ error: "Tarefa não encontrada." });

    return reply.send({ task: serializeTask(task), subtasks: await findSubtasks(auth.organizationId, task.id) });
  });

  app.patch("/api/tasks/:id", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const params = idSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const parsed = taskUpdateSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const current = await findTask(auth.organizationId, params.data.id);
    if (!current) return reply.code(404).send({ error: "Tarefa não encontrada." });
    await ensureResponsible(auth.organizationId, parsed.data.responsibleUserId);

    const updates: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.description !== undefined) updates.description = parsed.data.description?.trim() || null;
    if (parsed.data.responsibleUserId !== undefined) updates.responsibleUserId = parsed.data.responsibleUserId;
    if (parsed.data.category !== undefined) updates.category = parsed.data.category;
    if (parsed.data.dueAt !== undefined) {
      const dueAt = parseDate(parsed.data.dueAt);
      if (!dueAt) return reply.code(400).send({ error: "A data de vencimento é inválida." });
      updates.dueAt = dueAt;
    }
    if (parsed.data.completed !== undefined) {
      updates.completed = parsed.data.completed;
      updates.completedAt = parsed.data.completed ? new Date() : null;
    }

    await db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.id, current.id), eq(tasks.organizationId, auth.organizationId)));

    const updated = await findTask(auth.organizationId, current.id);
    if (!updated) throw new Error("Não foi possível atualizar a tarefa.");
    return reply.send({ task: serializeTask(updated) });
  });

  app.delete("/api/tasks/:id", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const params = idSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);

    const result = await db
      .delete(tasks)
      .where(and(eq(tasks.id, params.data.id), eq(tasks.organizationId, auth.organizationId)))
      .returning({ id: tasks.id });
    if (result.length === 0) return reply.code(404).send({ error: "Tarefa não encontrada." });
    return reply.code(204).send();
  });

  app.get("/api/tasks/:taskId/subtasks", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const params = taskIdSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const task = await findTask(auth.organizationId, params.data.taskId);
    if (!task) return reply.code(404).send({ error: "Tarefa não encontrada." });
    return reply.send({ subtasks: await findSubtasks(auth.organizationId, task.id) });
  });

  app.post("/api/tasks/:taskId/subtasks", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const params = taskIdSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const parsed = subtaskCreateSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    const task = await findTask(auth.organizationId, params.data.taskId);
    if (!task) return reply.code(404).send({ error: "Tarefa não encontrada." });

    const [subtask] = await db
      .insert(subtasks)
      .values({
        organizationId: auth.organizationId,
        taskId: task.id,
        name: parsed.data.name.trim(),
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning();
    if (!subtask) throw new Error("Não foi possível criar a subtarefa.");
    return reply.code(201).send({ subtask });
  });

  app.patch("/api/tasks/:taskId/subtasks/:subtaskId", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const params = subtaskParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const parsed = subtaskUpdateSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const [current] = await db
      .select()
      .from(subtasks)
      .where(
        and(
          eq(subtasks.id, params.data.subtaskId),
          eq(subtasks.taskId, params.data.taskId),
          eq(subtasks.organizationId, auth.organizationId),
        ),
      )
      .limit(1);
    if (!current) return reply.code(404).send({ error: "Subtarefa não encontrada." });

    const updates: Partial<typeof subtasks.$inferInsert> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
    if (parsed.data.completed !== undefined) {
      updates.completed = parsed.data.completed;
      updates.completedAt = parsed.data.completed ? new Date() : null;
    }

    const [updated] = await db
      .update(subtasks)
      .set(updates)
      .where(
        and(
          eq(subtasks.id, current.id),
          eq(subtasks.taskId, current.taskId),
          eq(subtasks.organizationId, auth.organizationId),
        ),
      )
      .returning();
    if (!updated) throw new Error("Não foi possível atualizar a subtarefa.");
    return reply.send({ subtask: updated });
  });

  app.delete("/api/tasks/:taskId/subtasks/:subtaskId", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const params = subtaskParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);

    const result = await db
      .delete(subtasks)
      .where(
        and(
          eq(subtasks.id, params.data.subtaskId),
          eq(subtasks.taskId, params.data.taskId),
          eq(subtasks.organizationId, auth.organizationId),
        ),
      )
      .returning({ id: subtasks.id });
    if (result.length === 0) return reply.code(404).send({ error: "Subtarefa não encontrada." });
    return reply.code(204).send();
  });
}
