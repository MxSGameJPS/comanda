import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { CUSTOMER_COOKIE, hashCustomerToken } from "@/lib/customer/session-token";
import { restSelect, rpc, safeRealtimeBroadcast } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Sua sessão da mesa expirou." }, { status: 401 });

    const tokenHash = hashCustomerToken(token);
    const sessions = await restSelect("table_sessions", {
      customer_access_token_hash: `eq.${tokenHash}`,
      select: "id,restaurant_id,status",
      limit: 1,
    }, { admin: true });
    const session = sessions?.[0];
    if (!session) return NextResponse.json({ error: "Comanda não encontrada." }, { status: 401 });
    if (session.status !== "OPEN") return NextResponse.json({ error: "Esta comanda já não aceita novos pedidos." }, { status: 409 });

    const { items } = await request.json();
    if (!Array.isArray(items) || !items.length) return NextResponse.json({ error: "Seu pedido está vazio." }, { status: 400 });
    if (items.length > 50) return NextResponse.json({ error: "Pedido grande demais. Divida em mais de um envio." }, { status: 400 });

    const normalized = items.map((item) => ({
      product_id: String(item.productId || ""),
      quantity: Math.max(1, Math.min(50, Number.parseInt(item.quantity, 10) || 1)),
      observation: String(item.observation || "").trim().slice(0, 500),
    }));
    if (normalized.some((item) => !item.product_id)) return NextResponse.json({ error: "Há um produto inválido no pedido." }, { status: 400 });

    const result = await rpc("create_customer_order", {
      p_session_id: session.id,
      p_token_hash: tokenHash,
      p_items: normalized,
    }, { admin: true });

    await safeRealtimeBroadcast(`restaurant:${session.restaurant_id}:operations`, "refresh", { type: "customer_order_created" });
    return NextResponse.json({ order: Array.isArray(result) ? result[0] : result }, { status: 201 });
  } catch (error) {
    return apiError(error, "Não foi possível enviar seu pedido.");
  }
}
