import { and, eq, gt } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client";
import { licenses, organizations, sessions, users } from "../db/schema";
import { HttpError } from "./errors";
import { createToken, hashToken } from "./utils";

export const SESSION_COOKIE = "taskflow_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export type AuthContext = {
  userId: string;
  organizationId: string;
  userName: string;
  email: string;
  role: "admin" | "member";
};

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export async function createSession(userId: string) {
  const token = createToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({ userId, tokenHash, expiresAt });

  return { token, expiresAt };
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAuthContext(request: FastifyRequest): Promise<AuthContext | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const [record] = await db
    .select({
      userId: users.id,
      organizationId: users.organizationId,
      userName: users.name,
      email: users.email,
      role: users.role,
      userStatus: users.status,
      expiresAt: sessions.expiresAt,
      licenseStatus: licenses.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .innerJoin(licenses, eq(licenses.organizationId, organizations.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!record || record.userStatus !== "active" || record.licenseStatus !== "active") {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return null;
  }

  return {
    userId: record.userId,
    organizationId: record.organizationId,
    userName: record.userName,
    email: record.email,
    role: record.role,
  };
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return reply.code(401).send({ error: "Autenticação necessária." });
  }

  request.auth = auth;
}

export function requireAuth(request: FastifyRequest) {
  if (!request.auth) {
    throw new HttpError(401, "Autenticação necessária.");
  }

  return request.auth;
}

export function requireAdmin(request: FastifyRequest) {
  const auth = requireAuth(request);
  if (auth.role !== "admin") {
    throw new HttpError(403, "Apenas administradores podem realizar esta ação.");
  }

  return auth;
}

export async function destroySession(request: FastifyRequest) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return;

  await db.delete(sessions).where(eq(sessions.tokenHash, await hashToken(token)));
}

export function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  status: "active" | "inactive";
  organizationId: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    organizationId: user.organizationId,
    createdAt: user.createdAt,
  };
}
