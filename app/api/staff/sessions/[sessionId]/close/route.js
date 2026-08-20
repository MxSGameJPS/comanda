import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restSelect, rpc, safeRealtimeBroadcast } from "@/lib/supabase/server";

const methods = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "OTHER"];

export async function POST(request, { params }) {
  try {
    const { sessionId } = await params;
    const { profile } = await requireStaff(["CASHIER", "MANAGER", "ADMIN", "OWNER"]);
    const { method } = await request.json();
    if (!methods.includes(method)) return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 400 });

    const sessions = await restSelect("table_sessions", {
      id: `eq.${sessionId}`,
      restaurant_id: `eq.${profile.restaurant_id}`,
      select: "id,table_id",
      limit: 1,
    }, { admin: true });
    const session = sessions?.[0];
    if (!session) return NextResponse.json({ error: "Comanda não encontrada." }, { status: 404 });

    const tables = await restSelect("restaurant_tables", {
      id: `eq.${session.table_id}`,
      restaurant_id: `eq.${profile.restaurant_id}`,
      select: "public_code",
      limit: 1,
    }, { admin: true });
    const tableCode = tables?.[0]?.public_code || null;

    const result = await rpc("close_table_session", {
      p_session_id: sessionId,
      p_employee_id: profile.id,
      p_method: method,
    }, { admin: true });

    const receiptRows = await restSelect("sales_receipts", {
      session_id: `eq.${sessionId}`,
      restaurant_id: `eq.${profile.restaurant_id}`,
      select: "id,restaurant_id,session_id,receipt_number,table_number,table_label,customer_name,customer_whatsapp,opened_at,closed_at,subtotal,discount,service_fee,total,payment_snapshot,staff_snapshot,items_snapshot,voids_snapshot,closed_by_employee_id,closed_by_name,created_at",
      limit: 1,
    }, { admin: true });
    const receipt = receiptRows?.[0] || null;

    await Promise.all([
      safeRealtimeBroadcast(`restaurant:${profile.restaurant_id}:operations`, "refresh", { type: "session_closed", receiptId: receipt?.id || null }),
      tableCode ? safeRealtimeBroadcast(`table:${tableCode}`, "refresh", { type: "session_closed" }) : Promise.resolve(null),
    ]);

    return NextResponse.json({ closed: Array.isArray(result) ? result[0] : result, receipt });
  } catch (error) {
    return apiError(error, "Não foi possível fechar a mesa.");
  }
}
