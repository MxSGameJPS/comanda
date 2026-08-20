import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";

export async function GET() {
  try {
    // Até a RLS de order_items ser restringida por estação, não entregamos
    // JWT ao navegador de cozinha/copa/caixa. Esses terminais usam polling curto.
    const { accessToken } = await requireStaff(["OWNER", "ADMIN", "MANAGER"]);
    return NextResponse.json({ accessToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Sessão em tempo real indisponível.");
  }
}
