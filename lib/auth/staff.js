import { cookies } from "next/headers";
import { restSelect, supabaseRequest } from "@/lib/supabase/server";

export const STAFF_ACCESS_COOKIE = "comanda_staff_access";
export const STAFF_REFRESH_COOKIE = "comanda_staff_refresh";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function isEmployeeActive(profile) {
  if (!profile?.is_active) return false;
  const now = Date.now();
  if (profile.active_from && new Date(profile.active_from).getTime() > now) return false;
  if (profile.active_until && new Date(profile.active_until).getTime() <= now) return false;
  return true;
}

export async function setStaffCookies(session) {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_ACCESS_COOKIE, session.access_token, { ...cookieOptions, maxAge: session.expires_in || 3600 });
  if (session.refresh_token) cookieStore.set(STAFF_REFRESH_COOKIE, session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearStaffCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_ACCESS_COOKIE);
  cookieStore.delete(STAFF_REFRESH_COOKIE);
}

async function fetchAuthUser(accessToken) {
  return supabaseRequest("/auth/v1/user", { accessToken });
}

async function refreshSession(refreshToken) {
  const session = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
  await setStaffCookies(session);
  return session;
}

export async function getStaffSession() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(STAFF_ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(STAFF_REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    const error = new Error("Faça login para continuar.");
    error.status = 401;
    throw error;
  }

  let user;
  try {
    if (!accessToken) throw Object.assign(new Error("Token ausente"), { status: 401 });
    user = await fetchAuthUser(accessToken);
  } catch (error) {
    if (error.status !== 401 || !refreshToken) throw error;
    const refreshed = await refreshSession(refreshToken);
    accessToken = refreshed.access_token;
    user = refreshed.user || await fetchAuthUser(accessToken);
  }

  const profiles = await restSelect("employee_profiles", {
    id: `eq.${user.id}`,
    select: "id,restaurant_id,name,role,employment_type,active_from,active_until,is_active",
    limit: 1,
  }, { admin: true });
  const profile = profiles?.[0];

  if (!profile || !isEmployeeActive(profile)) {
    const error = new Error("Acesso de funcionário inativo ou não cadastrado.");
    error.status = 403;
    throw error;
  }

  return { user, profile, accessToken };
}

export async function requireStaff(roles = []) {
  const session = await getStaffSession();
  if (roles.length && !roles.includes(session.profile.role)) {
    const error = new Error("Seu perfil não tem permissão para esta ação.");
    error.status = 403;
    throw error;
  }
  return session;
}
