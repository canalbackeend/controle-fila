import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { Tenant } from "@prisma/client";
import {
  idParams,
  adminPasswordResetInput,
  tenantAccessInput,
  tenantProvisionInput,
  type PlatformCompany,
} from "@beend/shared";
import { lockTenant, prisma, tenantTransaction } from "../../db.js";
import { missing } from "../../errors.js";
import type { Realtime } from "../../realtime.js";
import { createTenant } from "../admin/service.js";
import { requireActor } from "../auth/service.js";
import { allowance, assertLimits } from "../devices/limits.js";

function company(tenant: Tenant, kiosks = 0, panels = 0): PlatformCompany {
  const {
    id,
    name,
    slug,
    planName,
    kioskLimit,
    panelLimit,
    createdAt,
    suspendedAt,
  } = tenant;
  return {
    id,
    name,
    slug,
    planName,
    kioskLimit,
    panelLimit,
    active: !suspendedAt,
    createdAt: createdAt.toISOString(),
    deviceUsage: allowance(tenant, kiosks, panels),
  };
}

export function platformRoutes(app: FastifyInstance, realtime: Realtime) {
  app.get("/admin/tenants", async (request) => {
    await requireActor(request, ["SUPERADMIN"]);
    const tenants = await prisma.tenant.findMany({
      where: { users: { none: { role: "SUPERADMIN" } } },
      orderBy: { name: "asc" },
    });
    const devices = await prisma.device.groupBy({
      by: ["tenantId", "type"],
      where: { tenantId: { in: tenants.map(({ id }) => id) } },
      _count: { _all: true },
    });
    const counts = new Map(
      devices.map(({ tenantId, type, _count }) => [
        `${tenantId}:${type}`,
        _count._all,
      ]),
    );
    return tenants.map((tenant) =>
      company(
        tenant,
        counts.get(`${tenant.id}:KIOSK`),
        counts.get(`${tenant.id}:PANEL`),
      ),
    );
  });

  app.post("/admin/tenants", async (request, reply) => {
    await requireActor(request, ["SUPERADMIN"]);
    const input = tenantProvisionInput.parse(request.body);
    const tenant = await createTenant(input, "ADMIN", true);
    return reply.code(201).send(company(tenant));
  });

  app.put("/admin/tenants/:id", async (request) => {
    await requireActor(request, ["SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const { active, ...settings } = tenantAccessInput.parse(request.body);
    const result = await tenantTransaction(id, async (db) => {
      await lockTenant(db, id);
      const current = await db.tenant.findFirst({
        where: { users: { none: { role: "SUPERADMIN" } } },
      });
      if (!current) missing("Empresa não encontrada.");
      const [kiosks, panels] = await Promise.all([
        db.device.count({ where: { type: "KIOSK" } }),
        db.device.count({ where: { type: "PANEL" } }),
      ]);
      if (
        settings.kioskLimit !== current.kioskLimit ||
        settings.panelLimit !== current.panelLimit
      ) {
        assertLimits(settings, kiosks, panels);
      }
      const tenant = await db.tenant.update({
        where: { id },
        data: {
          ...settings,
          suspendedAt: active ? null : (current.suspendedAt ?? new Date()),
        },
      });
      return {
        record: company(tenant, kiosks, panels),
        didSuspend: !active && !current.suspendedAt,
      };
    });
    if (result.didSuspend) realtime.suspendTenant(id);
    return result.record;
  });
  app.post("/admin/tenants/:id/admin-password", async (request, reply) => {
    await requireActor(request, ["SUPERADMIN"]);
    const { id } = idParams.parse(request.params);
    const { email, password } = adminPasswordResetInput.parse(request.body);
    const passwordHash = await hash(password, 12);
    const userId = await tenantTransaction(id, async (db) => {
      await lockTenant(db, id);
      const tenant = await db.tenant.findFirst({
        where: { users: { none: { role: "SUPERADMIN" } } },
        select: { id: true },
      });
      if (!tenant) missing("Empresa não encontrada.");
      const user = await db.user.findFirst({
        where: { email, role: "ADMIN", active: true },
        select: { id: true },
      });
      if (!user) missing("Administrador ativo não encontrado nesta empresa.");
      await db.user.update({
        where: { id: user.id, role: "ADMIN", active: true },
        data: {
          passwordHash,
          mustChangePassword: true,
          credentialsChangedAt: new Date(),
        },
      });
      return user.id;
    });
    realtime.closeAccountSessions(id, userId);
    return reply.code(204).send();
  });
}
