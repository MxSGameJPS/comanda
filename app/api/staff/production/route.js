import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restSelect } from "@/lib/supabase/server";

const stationRoles = {
  KITCHEN: ["KITCHEN", "MANAGER", "ADMIN", "OWNER"],
  BAR: ["BAR", "MANAGER", "ADMIN", "OWNER"],
};
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" });

export async function GET(request) {
  try {
    const code = new URL(request.url).searchParams.get("station")?.toUpperCase();
    if (!stationRoles[code]) return NextResponse.json({ error: "Estação inválida." }, { status: 400 });
    const { profile } = await requireStaff(stationRoles[code]);
    const restaurantId = profile.restaurant_id;

    const [stations, tables, sessions] = await Promise.all([
      restSelect("prep_stations", { restaurant_id: `eq.${restaurantId}`, code: `eq.${code}`, active: "eq.true", select: "id,code,name", limit: 1 }, { admin: true }),
      restSelect("restaurant_tables", { restaurant_id: `eq.${restaurantId}`, active: "eq.true", select: "id,number,label,status", order: "number.asc" }, { admin: true }),
      restSelect("table_sessions", { restaurant_id: `eq.${restaurantId}`, status: "in.(OPEN,PAYMENT_PENDING)", select: "id,table_id,opened_at,status", order: "opened_at.asc" }, { admin: true }),
    ]);

    const station = stations?.[0] || null;
    const sessionMap = new Map(sessions.map((session) => [session.table_id, session]));
    const sessionIds = sessions.map((session) => session.id);
    let items = [];

    if (station && sessionIds.length) {
      items = await restSelect("order_items", {
        restaurant_id: `eq.${restaurantId}`,
        session_id: `in.(${sessionIds.join(",")})`,
        prep_station_id: `eq.${station.id}`,
        status: "in.(NEW,PREPARING,READY)",
        select: "id,session_id,product_name_snapshot,quantity,observation,status,created_at",
        order: "created_at.asc",
      }, { admin: true });
    }

    const itemsBySession = new Map();
    for (const item of items) {
      if (!itemsBySession.has(item.session_id)) itemsBySession.set(item.session_id, []);
      itemsBySession.get(item.session_id).push({
        id: item.id,
        name: item.product_name_snapshot,
        quantity: item.quantity,
        observation: item.observation,
        status: item.status,
        station: code,
      });
    }

    const boardTables = tables.map((table) => {
      const session = sessionMap.get(table.id) || null;
      return {
        tableId: table.id,
        sessionId: session?.id || null,
        number: table.number,
        label: table.label,
        tableStatus: table.status,
        sessionStatus: session?.status || null,
        openedAt: session ? timeFormatter.format(new Date(session.opened_at)) : null,
        items: session ? (itemsBySession.get(session.id) || []) : [],
      };
    });

    return NextResponse.json({
      tables: boardTables,
      station: code,
      realtimeTopic: `restaurant:${restaurantId}:operations`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível carregar a fila de produção.");
  }
}
