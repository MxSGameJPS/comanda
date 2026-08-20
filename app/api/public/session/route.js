import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { CUSTOMER_COOKIE, createCustomerToken, customerCookieOptions, hashCustomerToken } from "@/lib/customer/session-token";
import { restSelect, rpc } from "@/lib/supabase/server";

async function findSessionByToken(token) {
  if (!token) return null;
  const hash = hashCustomerToken(token);
  const sessions = await restSelect("table_sessions", {
    customer_access_token_hash: `eq.${hash}`,
    select: "id,table_id,customer_name,status,opened_at,subtotal,discount,service_fee,total,closed_at",
    limit: 1,
  }, { admin: true });
  return sessions?.[0] || null;
}

async function sessionMatchesTable(session, tableCode) {
  if (!session || !tableCode) return Boolean(session);
  const tables = await restSelect("restaurant_tables", {
    id: `eq.${session.table_id}`,
    public_code: `eq.${tableCode}`,
    active: "eq.true",
    select: "id",
    limit: 1,
  }, { admin: true });
  return Boolean(tables?.[0]);
}

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const session = await findSessionByToken(cookieStore.get(CUSTOMER_COOKIE)?.value);
    const tableCode = new URL(request.url).searchParams.get("tableCode");
    if (!session || !(await sessionMatchesTable(session, tableCode))) return NextResponse.json({ session: null });
    return NextResponse.json({ session: { ...session, subtotal: Number(session.subtotal), discount: Number(session.discount), service_fee: Number(session.service_fee), total: Number(session.total) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível consultar sua comanda.");
  }
}

export async function POST(request) {
  try {
    const { tableCode, name, whatsapp } = await request.json();
    if (!tableCode || !name?.trim() || !whatsapp?.trim()) return NextResponse.json({ error: "Informe nome e WhatsApp." }, { status: 400 });

    const token = createCustomerToken();
    const tokenHash = hashCustomerToken(token);
    const result = await rpc("open_table_session", {
      p_table_public_code: tableCode,
      p_customer_name: name.trim(),
      p_customer_whatsapp: whatsapp.trim(),
      p_token_hash: tokenHash,
    }, { admin: true });

    const row = Array.isArray(result) ? result[0] : result;
    const response = NextResponse.json({ session: row });
    response.cookies.set(CUSTOMER_COOKIE, token, customerCookieOptions);
    return response;
  } catch (error) {
    if (String(error.message).includes("already occupied")) {
      error.status = 409;
      error.message = "Esta mesa já possui uma comanda aberta. Chame um garçom para entrar na comanda existente.";
    }
    return apiError(error, "Não foi possível abrir a comanda.");
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CUSTOMER_COOKIE, "", { ...customerCookieOptions, maxAge: 0 });
  return response;
}
