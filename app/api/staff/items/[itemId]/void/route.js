import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { isEmployeeActive, requireStaff } from "@/lib/auth/staff";
import { restSelect, rpc, supabaseRequest } from "@/lib/supabase/server";

const allowedApproverRoles = ["WAITER", "CASHIER", "MANAGER", "ADMIN", "OWNER"];

export async function POST(request, { params }) {
  try {
    const { itemId } = await params;
    const { profile: operator } = await requireStaff(allowedApproverRoles);
    const { login, password, reason } = await request.json();

    const normalizedLogin = String(login || "").trim().toLowerCase();
    const cleanReason = String(reason || "").trim();
    if (!normalizedLogin || !password || cleanReason.length < 3) {
      return NextResponse.json({ error: "Informe o acesso do funcionário, a senha e o motivo." }, { status: 400 });
    }

    const field = normalizedLogin.includes("@") ? "login_email" : "login_code";
    const profiles = await restSelect("employee_profiles", {
      restaurant_id: `eq.${operator.restaurant_id}`,
      [field]: `eq.${normalizedLogin}`,
      select: "id,restaurant_id,name,role,employment_type,active_from,active_until,is_active,login_code,login_email",
      limit: 1,
    }, { admin: true });
    const approver = profiles?.[0];

    if (!approver || !isEmployeeActive(approver) || !allowedApproverRoles.includes(approver.role) || !approver.login_email) {
      return NextResponse.json({ error: "Funcionário não encontrado ou sem autorização para cancelar itens." }, { status: 403 });
    }

    let authSession;
    try {
      authSession = await supabaseRequest("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email: approver.login_email, password },
      });
    } catch {
      return NextResponse.json({ error: "Senha inválida para o funcionário informado." }, { status: 401 });
    }

    if (authSession?.user?.id !== approver.id) {
      return NextResponse.json({ error: "As credenciais não correspondem ao funcionário informado." }, { status: 403 });
    }

    const result = await rpc("void_order_item", {
      p_item_id: itemId,
      p_employee_id: approver.id,
      p_operator_id: operator.id,
      p_reason: cleanReason,
    }, { admin: true });

    const row = Array.isArray(result) ? result[0] : result;
    return NextResponse.json({ voided: row, authorizedBy: { id: approver.id, name: approver.name, role: approver.role } });
  } catch (error) {
    const message = String(error.message || "");
    if (message.includes("not linked")) {
      error.status = 403;
      error.message = "O garçom informado não está vinculado a esta mesa.";
    } else if (message.includes("already cancelled")) {
      error.status = 409;
      error.message = "Este item já foi cancelado.";
    } else if (message.includes("session is closed")) {
      error.status = 409;
      error.message = "A comanda já foi encerrada.";
    }
    return apiError(error, "Não foi possível cancelar o item.");
  }
}
