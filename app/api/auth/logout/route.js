import { NextResponse } from "next/server";
import { clearStaffCookies, STAFF_ACCESS_COOKIE } from "@/lib/auth/staff";
import { supabaseRequest } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(STAFF_ACCESS_COOKIE)?.value;
  if (accessToken) {
    try { await supabaseRequest("/auth/v1/logout", { method: "POST", accessToken }); } catch {}
  }
  await clearStaffCookies();
  return NextResponse.json({ ok: true });
}
