"use client";

function realtimeUrl() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return null;
  const wsBase = base.replace(/^http/, "ws").replace(/\/$/, "");
  return `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;
}

export async function subscribeToPostgresChanges({ channel, table, event = "*", filter, onChange, onStatus }) {
  const url = realtimeUrl();
  if (!url) {
    onStatus?.("disabled");
    return () => {};
  }

  let stopped = false;
  let socket;
  let heartbeat;
  let reconnectTimer;
  let attempt = 0;
  let ref = 1;

  async function connect() {
    if (stopped) return;
    try {
      const tokenResponse = await fetch("/api/auth/realtime-token", { cache: "no-store" });
      if (!tokenResponse.ok) throw new Error("Sessão indisponível");
      const { accessToken } = await tokenResponse.json();

      socket = new WebSocket(url);
      socket.addEventListener("open", () => {
        attempt = 0;
        onStatus?.("connecting");
        const joinRef = String(ref++);
        socket.send(JSON.stringify({
          topic: `realtime:${channel}`,
          event: "phx_join",
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { enabled: false },
              postgres_changes: [{ event, schema: "public", table, ...(filter ? { filter } : {}) }],
              private: false,
            },
            access_token: accessToken,
          },
          ref: joinRef,
          join_ref: joinRef,
        }));

        heartbeat = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(ref++), join_ref: null }));
          }
        }, 25000);
      });

      socket.addEventListener("message", (message) => {
        let payload;
        try { payload = JSON.parse(message.data); } catch { return; }
        if (payload.event === "phx_reply" && payload.payload?.status === "ok") onStatus?.("connected");
        if (payload.event === "postgres_changes") onChange?.(payload.payload);
        if (payload.event === "phx_error") onStatus?.("error");
      });

      socket.addEventListener("close", () => {
        if (heartbeat) window.clearInterval(heartbeat);
        if (stopped) return;
        onStatus?.("reconnecting");
        const delay = Math.min(10000, 1000 * (2 ** attempt++));
        reconnectTimer = window.setTimeout(connect, delay);
      });
    } catch {
      if (stopped) return;
      onStatus?.("reconnecting");
      const delay = Math.min(10000, 1000 * (2 ** attempt++));
      reconnectTimer = window.setTimeout(connect, delay);
    }
  }

  await connect();

  return () => {
    stopped = true;
    if (heartbeat) window.clearInterval(heartbeat);
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    socket?.close();
  };
}
