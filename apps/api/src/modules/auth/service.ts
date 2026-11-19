import { compare } from "bcryptjs";
import type { FastifyRequest } from "fastify";
import type { Actor, Role } from "@beend/shared";
import { prisma, tenantDb } from "../../db.js";
import { HttpError } from "../../errors.js";

export const sessionCookie = "beend_session";
const sessionSeconds = 8 * 60 * 60;
const dummyHash =
  "$2b$12$abcdefghijklmnopqrstuejY8UJpmQ.1c7MRZkuUnvD0C9Zi8t.8K";

export async function getActor(
  tenantId: string,
  userId: string,
): Promise<Actor | null> {
  const db = tenantDb(tenantId);
  const [user, unit, tenant] = await Promise.all([
    db.user.findFirst({
      where: { id: userId, active: true },
      select: { id: true, name: true, role: true },
    }),
    db.unit.findFirst({ orderBy: { id: "asc" }, select: { id: true } }),
    db.tenant.findUnique({ where: { id: tenantId } }),
  ]);
  if (!user || !unit || !tenant) return null;
  return {
    ...user,
    tenantId,
    unitId: unit.id,
    tenantName: tenant.name,
    timeZone: tenant.timeZone,
    resetTime: tenant.resetTime,
  };
}

export async function authenticate(
  tenantSlug: string,
  email: string,
  password: string,
) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  const user = tenant
    ? await tenantDb(tenant.id).user.findFirst({
        where: { email, active: true },
      })
    : null;
  const valid = await compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !valid)
    throw new HttpError(401, "Empresa, e-mail ou senha inválidos.");
  const actor = await getActor(user.tenantId, user.id);
  if (!actor) throw new HttpError(401, "Conta indisponível.");
  return actor;
}

export function sessionValue(actor: Actor) {
  return `${actor.tenantId}.${actor.id}.${Date.now() + sessionSeconds * 1000}`;
}

export const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  signed: true,
  maxAge: sessionSeconds,
};

export async function sessionActor(
  cookie: string | undefined,
  unsign: FastifyRequest["unsignCookie"],
) {
  if (!cookie) return null;
  const signed = unsign(cookie);
  if (!signed.valid || !signed.value) return null;
  const [tenantId, userId, expires] = signed.value.split(".");
  if (!tenantId || !userId || !expires || Number(expires) <= Date.now())
    return null;
  return getActor(tenantId, userId);
}

export async function requireActor(request: FastifyRequest, roles?: Role[]) {
  const actor = await sessionActor(
    request.cookies[sessionCookie],
    request.unsignCookie,
  );
  if (!actor) throw new HttpError(401, "Entre na sua conta para continuar.");
  if (roles && !roles.includes(actor.role))
    throw new HttpError(403, "Você não tem acesso a esta área.");
  return actor;
}
