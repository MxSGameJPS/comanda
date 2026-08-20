import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restInsert, restSelect, restUpdate } from "@/lib/supabase/server";

const transitions = { NEW: "PREPARING", PREPARING: "READY", READY: "SENT" };

export async function PATCH(request, { params }) {
  try {
    const { itemId } = await params;
    const { profile } = await requireStaff(["KITCHEN", "BAR", "MANAGER", "ADMIN", "OWNER"]);
    const rows = await restSelect("order_items", { id: `eq.${itemId}`, select: "id,restaurant_id,prep_station_id,status,session_id,product_name_snapshot", limit: 1 }, { admin: true });
    const item = rows?.[0];
    if (!item || item.restaurant_id !== profile.restaurant_id) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

    const stations = await restSelect("prep_stations", { id: `eq.${item.prep_station_id}`, select: "code", limit: 1 }, { admin: true });
    const stationCode = stations?.[0]?.code;
    if (profile.role === "KITCHEN" && stationCode !== "KITCHEN") return NextResponse.json({ error: "Item não pertence à cozinha." }, { status: 403 });
    if (profile.role === "BAR" && stationCode !== "BAR") return NextResponse.json({ error: "Item não pertence à copa." }, { status: 403 });

    const requested = (await request.json().catch(() => ({}))).status;
    const nextStatus = requested || transitions[item.status];
    if (!nextStatus || transitions[item.status] !== nextStatus) return NextResponse.json({ error: "Transição de status inválida." }, { status: 409 });

    const timestamps = nextStatus === "PREPARING" ? { prepared_at: new Date().toISOString() } : nextStatus === "READY" ? { ready_at: new Date().toISOString() } : { delivered_at: new Date().toISOString() };
    const updated = await restUpdate("order_items", { id: `eq.${item.id}`, status: `eq.${item.status}` }, { status: nextStatus, ...timestamps }, { admin: true });
    if (!updated?.length) return NextResponse.json({ error: "O item foi atualizado por outro terminal. Recarregue a fila." }, { status: 409 });

    await restInsert("audit_logs", { restaurant_id: profile.restaurant_id, actor_employee_id: profile.id, action: "ORDER_ITEM_STATUS_CHANGED", entity_type: "order_item", entity_id: item.id, before_data: { status: item.status }, after_data: { status: nextStatus }, metadata: { station: stationCode } }, { admin: true });
    return NextResponse.json({ item: updated[0] });
  } catch (error) {
    return apiError(error, "Não foi possível atualizar o item.");
  }
}
