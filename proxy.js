import { NextResponse } from "next/server";

export default function proxy(request) {
  const hasSession = request.cookies.has("comanda_staff_access") || request.cookies.has("comanda_staff_refresh");
  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/garcom/:path*", "/cozinha/:path*", "/copa/:path*", "/caixa/:path*", "/controle/:path*"],
};
