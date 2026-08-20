import { NextResponse } from "next/server";

export function apiError(error, fallback = "Não foi possível concluir a operação.") {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const safeMessage = status >= 500 ? fallback : (error?.message || fallback);
  if (status >= 500) console.error(error);
  return NextResponse.json({ error: safeMessage }, { status });
}
