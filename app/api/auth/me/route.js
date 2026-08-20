import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { getStaffSession } from "@/lib/auth/staff";

export async function GET() {
  try {
    const { profile } = await getStaffSession();
    return NextResponse.json({ employee: profile });
  } catch (error) {
    return apiError(error, "Não foi possível validar sua sessão.");
  }
}
