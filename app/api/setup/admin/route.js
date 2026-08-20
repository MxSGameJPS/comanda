import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { setStaffCookies } from "@/lib/auth/staff";
import { restInsert, restSelect, supabaseRequest } from "@/lib/supabase/server";

function secureEqual(value, expected) {
  const a = Buffer.from(String(value || ""));
  const b = Buffer.from(String(expected || ""));
  if (!a.length || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function existingAdmin() {
  const rows = await restSelect("employee_profiles", { role: "in.(OWNER,ADMIN)", select: "id", limit: 1 }, { admin: true });
  return Boolean(rows?.length);
}

export async function GET() {
  try {
    return NextResponse.json({ hasAdmin: await existingAdmin(), setupKeyConfigured: Boolean(process.env.ADMIN_SETUP_KEY) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível verificar a configuração inicial.");
  }
}

export async function POST(request) {
  let createdUserId = null;
  try {
    if (await existingAdmin()) return NextResponse.json({ error: "O administrador inicial já foi configurado." }, { status: 409 });
    if (!process.env.ADMIN_SETUP_KEY) return NextResponse.json({ error: "ADMIN_SETUP_KEY não configurada no servidor." }, { status: 503 });

    const { setupKey, restaurantName, name, email, password } = await request.json();
    if (!secureEqual(setupKey, process.env.ADMIN_SETUP_KEY)) return NextResponse.json({ error: "Chave de instalação inválida." }, { status: 403 });
    if (!restaurantName?.trim() || !name?.trim() || !email?.trim() || String(password || "").length < 8) {
      return NextResponse.json({ error: "Informe restaurante, nome, e-mail e uma senha com pelo menos 8 caracteres." }, { status: 400 });
    }

    let restaurants = await restSelect("restaurants", { select: "id,name", order: "created_at.asc", limit: 1 }, { admin: true });
    if (!restaurants?.length) restaurants = await restInsert("restaurants", { name: restaurantName.trim() }, { admin: true });
    const restaurant = restaurants[0];

    const normalizedEmail = email.trim().toLowerCase();
    const created = await supabaseRequest("/auth/v1/admin/users", {
      method: "POST",
      admin: true,
      body: { email: normalizedEmail, password, email_confirm: true, user_metadata: { name: name.trim() } },
    });
    const user = created?.user || created;
    createdUserId = user.id;

    await restInsert("employee_profiles", {
      id: user.id,
      restaurant_id: restaurant.id,
      name: name.trim(),
      role: "OWNER",
      employment_type: "FIXED",
      is_active: true,
      login_email: normalizedEmail,
    }, { admin: true });

    const stations = await restSelect("prep_stations", { restaurant_id: `eq.${restaurant.id}`, select: "code" }, { admin: true });
    const codes = new Set(stations.map((item) => item.code));
    const missing = [];
    if (!codes.has("KITCHEN")) missing.push({ restaurant_id: restaurant.id, code: "KITCHEN", name: "Cozinha", active: true });
    if (!codes.has("BAR")) missing.push({ restaurant_id: restaurant.id, code: "BAR", name: "Copa", active: true });
    if (missing.length) await restInsert("prep_stations", missing, { admin: true });

    const session = await supabaseRequest("/auth/v1/token?grant_type=password", { method: "POST", body: { email: normalizedEmail, password } });
    await setStaffCookies(session);
    return NextResponse.json({ ok: true, redirectTo: `/controle/${process.env.ADMIN_ROUTE_SLUG || "gestao"}` });
  } catch (error) {
    if (createdUserId) {
      try { await supabaseRequest(`/auth/v1/admin/users/${createdUserId}`, { method: "DELETE", admin: true }); } catch {}
    }
    return apiError(error, "Não foi possível criar o administrador inicial.");
  }
}
