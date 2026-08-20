function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !publishableKey) {
    const error = new Error("Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
    error.status = 503;
    throw error;
  }

  return { url, publishableKey, secretKey };
}

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function supabaseRequest(path, options = {}) {
  const { method = "GET", body, accessToken, admin = false, prefer, headers: extraHeaders = {} } = options;
  const { url, publishableKey, secretKey } = getConfig();
  const apiKey = admin ? secretKey : publishableKey;

  if (admin && !secretKey) {
    const error = new Error("SUPABASE_SECRET_KEY não configurada no servidor.");
    error.status = 503;
    throw error;
  }

  const headers = {
    apikey: apiKey,
    Accept: "application/json",
    ...extraHeaders,
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }

  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || `Supabase respondeu ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function restSelect(table, params = {}, options = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  return supabaseRequest(`/rest/v1/${table}${suffix}`, options);
}

export async function restInsert(table, body, options = {}) {
  return supabaseRequest(`/rest/v1/${table}`, {
    method: "POST",
    body,
    prefer: "return=representation",
    ...options,
  });
}

export async function restUpdate(table, filters, body, options = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) query.set(key, String(value));
  return supabaseRequest(`/rest/v1/${table}?${query.toString()}`, {
    method: "PATCH",
    body,
    prefer: "return=representation",
    ...options,
  });
}

export async function rpc(name, body, options = {}) {
  return supabaseRequest(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body,
    ...options,
  });
}
