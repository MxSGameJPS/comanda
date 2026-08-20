import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restSelect } from "@/lib/supabase/server";

export async function GET(_request, { params }) {
  try {
    const { receiptId } = await params;
    const { profile } = await requireStaff(["CASHIER", "MANAGER", "ADMIN", "OWNER"]);
    const rows = await restSelect("sales_receipts", {
      id: `eq.${receiptId}`,
      restaurant_id: `eq.${profile.restaurant_id}`,
      select: "id,restaurant_id,session_id,receipt_number,table_number,table_label,customer_name,customer_whatsapp,opened_at,closed_at,subtotal,discount,service_fee,total,payment_snapshot,staff_snapshot,items_snapshot,voids_snapshot,closed_by_employee_id,closed_by_name,created_at",
      limit: 1,
    }, { admin: true });

    const receipt = rows?.[0];
    if (!receipt) return NextResponse.json({ error: "Comprovante não encontrado." }, { status: 404 });

    return NextResponse.json({ receipt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível carregar o comprovante interno.");
  }
}
