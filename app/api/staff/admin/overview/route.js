import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restSelect } from "@/lib/supabase/server";

const saoPauloDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" });

export async function GET() {
  try {
    const { profile } = await requireStaff(["OWNER", "ADMIN", "MANAGER"]);
    const start = `${saoPauloDate()}T00:00:00-03:00`;

    const [closedSessions, openSessions, voids, payments, employees, audit] = await Promise.all([
      restSelect("table_sessions", { restaurant_id: `eq.${profile.restaurant_id}`, status: "eq.CLOSED", closed_at: `gte.${start}`, select: "id,total,closed_at" }, { admin: true }),
      restSelect("table_sessions", { restaurant_id: `eq.${profile.restaurant_id}`, status: "in.(OPEN,PAYMENT_PENDING)", select: "id,table_id,status,total" }, { admin: true }),
      restSelect("item_voids", { restaurant_id: `eq.${profile.restaurant_id}`, created_at: `gte.${start}`, select: "id,session_id,product_name_snapshot,quantity,total_price,reason,employee_id,created_at", order: "created_at.desc" }, { admin: true }),
      restSelect("payments", { restaurant_id: `eq.${profile.restaurant_id}`, created_at: `gte.${start}`, select: "id,session_id,method,amount,employee_id,created_at" }, { admin: true }),
      restSelect("employee_profiles", { restaurant_id: `eq.${profile.restaurant_id}`, is_active: "eq.true", select: "id,name,role,employment_type,active_from,active_until,is_active", order: "name.asc" }, { admin: true }),
      restSelect("audit_logs", { restaurant_id: `eq.${profile.restaurant_id}`, select: "id,actor_employee_id,action,entity_type,entity_id,after_data,metadata,created_at", order: "created_at.desc", limit: 25 }, { admin: true }),
    ]);

    const sales = closedSessions.reduce((sum, session) => sum + Number(session.total || 0), 0);
    const ticket = closedSessions.length ? sales / closedSessions.length : 0;
    const cancelled = voids.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    const paymentMethods = payments.reduce((acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + Number(payment.amount || 0);
      return acc;
    }, {});

    const actorIds = [...new Set([...audit.map((entry) => entry.actor_employee_id), ...voids.map((entry) => entry.employee_id)].filter(Boolean))];
    const actorRows = actorIds.length ? await restSelect("employee_profiles", { id: `in.(${actorIds.join(",")})`, select: "id,name,role" }, { admin: true }) : [];
    const actorMap = Object.fromEntries(actorRows.map((employee) => [employee.id, employee]));

    const auditRows = audit.map((entry) => ({
      id: entry.id,
      time: timeFormatter.format(new Date(entry.created_at)),
      action: entry.action,
      entityType: entry.entity_type,
      actor: actorMap[entry.actor_employee_id]?.name || "Sistema",
      actorRole: actorMap[entry.actor_employee_id]?.role || null,
      reason: entry.after_data?.reason || entry.metadata?.reason || null,
      sessionId: entry.metadata?.session_id || (entry.entity_type === "table_session" ? entry.entity_id : null),
    }));

    return NextResponse.json({
      metrics: {
        sales,
        closedCommands: closedSessions.length,
        averageTicket: ticket,
        occupiedTables: openSessions.length,
        cancelledValue: cancelled,
        cancellations: voids.length,
      },
      paymentMethods,
      employees,
      audit: auditRows,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível carregar o painel administrativo.");
  }
}
