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

    // A RPC fecha a comanda, registra o pagamento e libera a mesa na mesma transação.
    // A partir deste ponto a liberação da mesa é a prioridade do fluxo.
    const result = await rpc("close_table_session", {
      p_session_id: sessionId,
      p_employee_id: profile.id,
      p_method: method,
    }, { admin: true });
    const closed = Array.isArray(result) ? result[0] : result;

    // Avise os terminais imediatamente após a transação confirmar. A geração/leitura
    // do comprovante nunca deve atrasar a visualização da mesa como disponível.
    await Promise.all([
      safeRealtimeBroadcast(`restaurant:${profile.restaurant_id}:operations`, "refresh", { type: "session_closed", tableId: session.table_id }),
      tableCode ? safeRealtimeBroadcast(`table:${tableCode}`, "refresh", { type: "session_closed" }) : Promise.resolve(null),
    ]);

    let receipt = null;
    let receiptWarning = null;
    try {
      const receiptRows = await restSelect("sales_receipts", {
        session_id: `eq.${sessionId}`,
        restaurant_id: `eq.${profile.restaurant_id}`,
        select: "id,restaurant_id,session_id,receipt_number,table_number,table_label,customer_name,customer_whatsapp,opened_at,closed_at,subtotal,discount,service_fee,total,payment_snapshot,staff_snapshot,items_snapshot,voids_snapshot,closed_by_employee_id,closed_by_name,created_at",
        limit: 1,
      }, { admin: true });
      receipt = receiptRows?.[0] || null;
      if (!receipt) receiptWarning = "Pagamento concluído e mesa liberada. O comprovante interno ainda não ficou disponível.";
    } catch (receiptError) {
      console.error("Failed to load receipt after session close", receiptError);
      receiptWarning = "Pagamento concluído e mesa liberada. Não foi possível carregar o comprovante interno agora.";
    }

    return NextResponse.json({ closed, receipt, receiptWarning, tableReleased: true, tableId: session.table_id });
  } catch (error) {
    return apiError(error, "Não foi possível fechar a mesa.");
  }
}
