import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { rpc, safeRealtimeBroadcast } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const { profile } = await requireStaff(["CASHIER", "MANAGER", "ADMIN", "OWNER"]);
    const { sessionId, items } = await request.json();
    if (!sessionId || !Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: "Informe a comanda e pelo menos um item." }, { status: 400 });
    }

    const normalizedItems = items.slice(0, 80).map((item) => ({
      product_id: item.productId,
      quantity: Math.max(1, Math.min(50, Number(item.quantity) || 1)),
      observation: String(item.observation || "").trim().slice(0, 500),
    }));
    if (normalizedItems.some((item) => !item.product_id)) {
      return NextResponse.json({ error: "Há um produto inválido no pedido." }, { status: 400 });
    }

    const result = await rpc("create_staff_order", {
      p_session_id: sessionId,
      p_employee_id: profile.id,
      p_items: normalizedItems,
    }, { admin: true });
    const row = Array.isArray(result) ? result[0] : result;
    await safeRealtimeBroadcast(`restaurant:${profile.restaurant_id}:operations`, "refresh", { type: "cashier_order_created" });
    return NextResponse.json({ order: row }, { status: 201 });
  } catch (error) {
    if (String(error.message || "").includes("not open")) {
      error.status = 409;
      error.message = "Esta comanda não aceita novos lançamentos.";
    }
    return apiError(error, "Não foi possível lançar o item pelo caixa.");
  }
}
