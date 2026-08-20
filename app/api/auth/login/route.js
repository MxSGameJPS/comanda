import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { isEmployeeActive, setStaffCookies } from "@/lib/auth/staff";
import { restSelect, restUpdate, supabaseRequest } from "@/lib/supabase/server";

const redirects = {
  OWNER: "/controle/gestao",
  ADMIN: "/controle/gestao",
  MANAGER: "/controle/gestao",
  CASHIER: "/caixa",
  WAITER: "/garcom",
  KITCHEN: "/cozinha",
  BAR: "/copa",
};

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });

    const normalizedEmail = String(email).trim().toLowerCase();
    const session = await supabaseRequest("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email: normalizedEmail, password },
    });

    const profiles = await restSelect("employee_profiles", {
      id: `eq.${session.user.id}`,
      select: "id,restaurant_id,name,role,employment_type,active_from,active_until,is_active",
      limit: 1,
    }, { admin: true });
    const profile = profiles?.[0];

    if (!profile || !isEmployeeActive(profile)) {
      return NextResponse.json({ error: "Este usuário não possui acesso ativo ao restaurante." }, { status: 403 });
    }

    try {
      await restUpdate("employee_profiles", { id: `eq.${profile.id}` }, { login_email: normalizedEmail }, { admin: true });
    } catch {
      // Compatibilidade enquanto a migration 002 ainda não tiver sido aplicada.
    }

    await setStaffCookies(session);
    return NextResponse.json({
      employee: { id: profile.id, name: profile.name, role: profile.role },
      redirectTo: redirects[profile.role] || "/login",
    });
  } catch (error) {
    if (error.status === 400) error.message = "E-mail ou senha inválidos.";
    return apiError(error, "Não foi possível entrar no sistema.");
  }
}
