import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { rpc } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const { profile } = await requireStaff(["WAITER", "MANAGER", "ADMIN", "OWNER"]);
    const { tableCode } = await request.json();
    if (!tableCode) return NextResponse.json({ error: "QR Code da mesa não informado." }, { status: 400 });

    const result = await rpc("link_waiter_session", {
      p_table_public_code: String(tableCode),
      p_employee_id: profile.id,
    }, { admin: true });

    const row = Array.isArray(result) ? result[0] : result;
    return NextResponse.json({ session: row });
  } catch (error) {
    const message = String(error.message || "");
    if (message.includes("table not found")) {
      error.status = 404;
      error.message = "Mesa não encontrada para este restaurante.";
    } else if (message.includes("no active session")) {
      error.status = 409;
      error.message = "Esta mesa ainda não possui uma comanda aberta.";
    }
    return apiError(error, "Não foi possível vincular o garçom à mesa.");
  }
}
