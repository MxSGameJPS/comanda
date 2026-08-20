import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { rpc } from "@/lib/supabase/server";

const methods = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "OTHER"];

export async function POST(request, { params }) {
  try {
    const { sessionId } = await params;
    const { profile } = await requireStaff(["CASHIER", "MANAGER", "ADMIN", "OWNER"]);
    const { method } = await request.json();
    if (!methods.includes(method)) return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 400 });

    const result = await rpc("close_table_session", {
      p_session_id: sessionId,
      p_employee_id: profile.id,
      p_method: method,
    }, { admin: true });
    return NextResponse.json({ closed: Array.isArray(result) ? result[0] : result });
  } catch (error) {
    return apiError(error, "Não foi possível fechar a mesa.");
  }
}
