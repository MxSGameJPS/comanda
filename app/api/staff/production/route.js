import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restSelect } from "@/lib/supabase/server";

const stationRoles = {
  KITCHEN: ["KITCHEN", "MANAGER", "ADMIN", "OWNER"],
  BAR: ["BAR", "MANAGER", "ADMIN", "OWNER"],
};

export async function GET(request) {
  try {
    const code = new URL(request.url).searchParams.get("station")?.toUpperCase();
    if (!stationRoles[code]) return NextResponse.json({ error: "Estação inválida." }, { status: 400 });
    const { profile } = await requireStaff(stationRoles[code]);

    const stations = await restSelect("prep_stations", { restaurant_id: `eq.${profile.restaurant_id}`, code: `eq.${code}`, active: "eq.true", select: "id,code,name", limit: 1 }, { admin: true });
    const station = stations?.[0];
    if (!station) return NextResponse.json({ tables: [], station: code });

    const items = await restSelect("order_items", {
      restaurant_id: `eq.${profile.restaurant_id}`,
      prep_station_id: `eq.${station.id}`,
      status: "in.(NEW,PREPARING,READY)",
      select: "id,session_id,product_name_snapshot,quantity,observation,status,created_at",
      order: "created_at.asc",
    }, { admin: true });

    const sessionIds = [...new Set(items.map((item) => item.session_id))];
    if (!sessionIds.length) return NextResponse.json({ tables: [], station: code });
    const sessions = await restSelect("table_sessions", { id: `in.(${sessionIds.join(",")})`, select: "id,table_id,opened_at,status" }, { admin: true });
    const tableIds = [...new Set(sessions.map((session) => session.table_id))];
    const tables = await restSelect("restaurant_tables", { id: `in.(${tableIds.join(",")})`, select: "id,number" }, { admin: true });
    const tableMap = Object.fromEntries(tables.map((table) => [table.id, table]));
    const sessionMap = Object.fromEntries(sessions.map((session) => [session.id, session]));

    const grouped = new Map();
    for (const item of items) {
      const session = sessionMap[item.session_id];
      const table = session && tableMap[session.table_id];
      if (!session || !table) continue;
      if (!grouped.has(session.id)) grouped.set(session.id, { sessionId: session.id, number: table.number, openedAt: new Date(session.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), items: [] });
      grouped.get(session.id).items.push({ id: item.id, name: item.product_name_snapshot, quantity: item.quantity, observation: item.observation, status: item.status, station: code });
    }

    return NextResponse.json({ tables: [...grouped.values()], station: code }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível carregar a fila de produção.");
  }
}
