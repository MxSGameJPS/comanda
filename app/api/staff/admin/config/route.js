import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restInsert, restSelect, restUpdate, supabaseRequest } from "@/lib/supabase/server";

const employeeRoles = ["ADMIN", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "BAR"];

function slugify(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function owned(table, id, restaurantId, select = "id") {
  if (!id) return null;
  const rows = await restSelect(table, { id: `eq.${id}`, restaurant_id: `eq.${restaurantId}`, select, limit: 1 }, { admin: true });
  return rows?.[0] || null;
}

function requireConfigAdmin(profile) {
  if (!["OWNER", "ADMIN"].includes(profile.role)) {
    const error = new Error("Somente proprietário ou administrador pode alterar os cadastros.");
    error.status = 403;
    throw error;
  }
}

export async function GET() {
  try {
    const { profile } = await requireStaff(["OWNER", "ADMIN", "MANAGER"]);
    const restaurantId = profile.restaurant_id;
    const [tables, categories, stations, products, employees] = await Promise.all([
      restSelect("restaurant_tables", { restaurant_id: `eq.${restaurantId}`, select: "id,number,label,seats,public_code,status,active,created_at", order: "number.asc" }, { admin: true }),
      restSelect("categories", { restaurant_id: `eq.${restaurantId}`, select: "id,name,slug,sort_order,active", order: "sort_order.asc,name.asc" }, { admin: true }),
      restSelect("prep_stations", { restaurant_id: `eq.${restaurantId}`, select: "id,code,name,active", order: "name.asc" }, { admin: true }),
      restSelect("products", { restaurant_id: `eq.${restaurantId}`, select: "id,name,description,price,category_id,prep_station_id,active,sort_order,image_url", order: "sort_order.asc,name.asc" }, { admin: true }),
      restSelect("employee_profiles", { restaurant_id: `eq.${restaurantId}`, select: "id,name,role,employment_type,active_from,active_until,is_active,login_code,login_email", order: "name.asc" }, { admin: true }),
    ]);
    return NextResponse.json({ restaurantId, currentRole: profile.role, tables, categories, stations, products: products.map((p) => ({ ...p, price: Number(p.price) })), employees }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível carregar os cadastros.");
  }
}

export async function POST(request) {
  let createdUserId = null;
  try {
    const { profile } = await requireStaff(["OWNER", "ADMIN"]);
    requireConfigAdmin(profile);
    const { resource, data = {} } = await request.json();
    const restaurantId = profile.restaurant_id;

    if (resource === "table") {
      const number = Number(data.number);
      const seats = data.seats ? Number(data.seats) : null;
      if (!Number.isInteger(number) || number < 1) return bad("Informe um número de mesa válido.");
      if (seats !== null && (!Number.isInteger(seats) || seats < 1)) return bad("Informe uma quantidade de lugares válida.");
      const rows = await restInsert("restaurant_tables", { restaurant_id: restaurantId, number, label: data.label?.trim() || null, seats, active: true }, { admin: true });
      return NextResponse.json({ item: rows[0] });
    }

    if (resource === "category") {
      if (!data.name?.trim()) return bad("Informe o nome da categoria.");
      const rows = await restInsert("categories", { restaurant_id: restaurantId, name: data.name.trim(), slug: slugify(data.name), sort_order: Number(data.sortOrder || 0), active: true }, { admin: true });
      return NextResponse.json({ item: rows[0] });
    }

    if (resource === "station") {
      const code = String(data.code || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      if (!code || !data.name?.trim()) return bad("Informe código e nome da estação.");
      const rows = await restInsert("prep_stations", { restaurant_id: restaurantId, code, name: data.name.trim(), active: true }, { admin: true });
      return NextResponse.json({ item: rows[0] });
    }

    if (resource === "product") {
      const price = Number(data.price);
      if (!data.name?.trim() || price < 0 || !Number.isFinite(price)) return bad("Informe nome e preço válido.");
      const category = data.categoryId ? await owned("categories", data.categoryId, restaurantId) : null;
      const station = data.stationId ? await owned("prep_stations", data.stationId, restaurantId) : null;
      if (data.categoryId && !category) return bad("Categoria inválida.");
      if (data.stationId && !station) return bad("Estação inválida.");
      const rows = await restInsert("products", { restaurant_id: restaurantId, name: data.name.trim(), description: data.description?.trim() || null, price, category_id: category?.id || null, prep_station_id: station?.id || null, sort_order: Number(data.sortOrder || 0), active: true }, { admin: true });
      return NextResponse.json({ item: rows[0] });
    }

    if (resource === "employee") {
      const role = String(data.role || "").toUpperCase();
      if (!employeeRoles.includes(role)) return bad("Função inválida.");
      if (role === "ADMIN" && profile.role !== "OWNER") return bad("Somente o proprietário pode criar outro administrador.", 403);
      if (!data.name?.trim() || !data.email?.trim() || String(data.password || "").length < 8) return bad("Informe nome, e-mail e senha com pelo menos 8 caracteres.");
      const normalizedEmail = data.email.trim().toLowerCase();
      const created = await supabaseRequest("/auth/v1/admin/users", { method: "POST", admin: true, body: { email: normalizedEmail, password: data.password, email_confirm: true, user_metadata: { name: data.name.trim() } } });
      const user = created?.user || created;
      createdUserId = user.id;
      const employmentType = data.employmentType === "TEMPORARY" ? "TEMPORARY" : "FIXED";
      const rows = await restInsert("employee_profiles", { id: user.id, restaurant_id: restaurantId, name: data.name.trim(), role, employment_type: employmentType, active_until: employmentType === "TEMPORARY" && data.activeUntil ? data.activeUntil : null, is_active: true, login_code: data.loginCode?.trim().toLowerCase() || null, login_email: normalizedEmail }, { admin: true });
      return NextResponse.json({ item: rows[0] });
    }

    return bad("Recurso inválido.");
  } catch (error) {
    if (createdUserId) {
      try { await supabaseRequest(`/auth/v1/admin/users/${createdUserId}`, { method: "DELETE", admin: true }); } catch {}
    }
    return apiError(error, "Não foi possível criar o cadastro.");
  }
}

export async function PATCH(request) {
  try {
    const { profile } = await requireStaff(["OWNER", "ADMIN"]);
    requireConfigAdmin(profile);
    const { resource, id, data = {} } = await request.json();
    const restaurantId = profile.restaurant_id;

    if (resource === "table") {
      const item = await owned("restaurant_tables", id, restaurantId);
      if (!item) return bad("Mesa não encontrada.", 404);
      if (data.active === false) {
        const sessions = await restSelect("table_sessions", { table_id: `eq.${id}`, status: "in.(OPEN,PAYMENT_PENDING)", select: "id", limit: 1 }, { admin: true });
        if (sessions.length) return bad("Não é possível desativar uma mesa com comanda aberta.", 409);
      }
      const patch = {};
      if (data.active !== undefined) patch.active = Boolean(data.active);
      if (data.label !== undefined) patch.label = data.label?.trim() || null;
      if (data.seats !== undefined) {
        const seats = data.seats ? Number(data.seats) : null;
        if (seats !== null && (!Number.isInteger(seats) || seats < 1)) return bad("Quantidade de lugares inválida.");
        patch.seats = seats;
      }
      if (data.number !== undefined) {
        const number = Number(data.number);
        if (!Number.isInteger(number) || number < 1) return bad("Número de mesa inválido.");
        patch.number = number;
      }
      const rows = await restUpdate("restaurant_tables", { id: `eq.${id}`, restaurant_id: `eq.${restaurantId}` }, patch, { admin: true });
      return NextResponse.json({ item: rows[0] });
    }

    if (["category", "station", "product"].includes(resource)) {
      const table = resource === "category" ? "categories" : resource === "station" ? "prep_stations" : "products";
      const item = await owned(table, id, restaurantId);
      if (!item) return bad("Cadastro não encontrado.", 404);

      if (data.active === false && resource === "category") {
        const products = await restSelect("products", { category_id: `eq.${id}`, restaurant_id: `eq.${restaurantId}`, active: "eq.true", select: "id", limit: 1 }, { admin: true });
        if (products.length) return bad("Desative ou mova os produtos ativos desta categoria antes de desativá-la.", 409);
      }
      if (data.active === false && resource === "station") {
        const products = await restSelect("products", { prep_station_id: `eq.${id}`, restaurant_id: `eq.${restaurantId}`, active: "eq.true", select: "id", limit: 1 }, { admin: true });
        if (products.length) return bad("Existem produtos ativos enviados para esta estação.", 409);
      }

      const patch = {};
      if (data.active !== undefined) patch.active = Boolean(data.active);
      if (resource === "product" && data.price !== undefined) {
        const price = Number(data.price);
        if (!Number.isFinite(price) || price < 0) return bad("Preço inválido.");
        patch.price = price;
      }
      if (data.name !== undefined) {
        if (!String(data.name).trim()) return bad("Nome inválido.");
        patch.name = String(data.name).trim();
      }
      const rows = await restUpdate(table, { id: `eq.${id}`, restaurant_id: `eq.${restaurantId}` }, patch, { admin: true });
      return NextResponse.json({ item: rows[0] });
    }

    if (resource === "employee") {
      const target = await owned("employee_profiles", id, restaurantId, "id,role,is_active");
      if (!target) return bad("Funcionário não encontrado.", 404);
      if (id === profile.id && data.isActive === false) return bad("Você não pode desativar seu próprio acesso.");
      if (target.role === "OWNER" && profile.role !== "OWNER") return bad("Somente o proprietário pode alterar este acesso.", 403);
      const patch = {};
      if (data.isActive !== undefined) patch.is_active = Boolean(data.isActive);
      if (data.loginCode !== undefined) patch.login_code = data.loginCode?.trim().toLowerCase() || null;
      if (data.activeUntil !== undefined) patch.active_until = data.activeUntil || null;
      if (data.role !== undefined) {
        const role = String(data.role).toUpperCase();
        if (!employeeRoles.includes(role)) return bad("Função inválida.");
        if (role === "ADMIN" && profile.role !== "OWNER") return bad("Somente o proprietário pode promover administradores.", 403);
        patch.role = role;
      }
      if (Object.keys(patch).length) await restUpdate("employee_profiles", { id: `eq.${id}`, restaurant_id: `eq.${restaurantId}` }, patch, { admin: true });
      if (data.password) {
        if (String(data.password).length < 8) return bad("A nova senha deve ter pelo menos 8 caracteres.");
        await supabaseRequest(`/auth/v1/admin/users/${id}`, { method: "PUT", admin: true, body: { password: data.password } });
      }
      return NextResponse.json({ ok: true });
    }

    return bad("Recurso inválido.");
  } catch (error) {
    return apiError(error, "Não foi possível atualizar o cadastro.");
  }
}
