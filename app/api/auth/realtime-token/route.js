import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { getStaffSession } from "@/lib/auth/staff";

export async function GET() {
  try {
    const { accessToken } = await getStaffSession();
    return NextResponse.json({ accessToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Sessão em tempo real indisponível.");
  }
}
