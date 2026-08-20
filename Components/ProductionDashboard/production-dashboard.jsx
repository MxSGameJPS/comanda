"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TableCard from "@/Components/TableCard/table-card";
import { productionTables } from "@/lib/mock-data";
import { subscribeToBroadcast } from "@/lib/realtime/client";
import styles from "./production-dashboard.module.css";

export default function ProductionDashboard({ station, title }) {
  const [tables, setTables] = useState(process.env.NEXT_PUBLIC_ENABLE_DEMO === "true" ? productionTables.filter((table) => table.items.some((item) => item.station === station)) : []);
  const [connection, setConnection] = useState("connecting");
  const [realtimeTopic, setRealtimeTopic] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [busyItem, setBusyItem] = useState(null);
  const previousNewCount = useRef(0);
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/staff/production?station=${encodeURIComponent(station)}`, { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }
      const body = await response.json();
      if (!response.ok) return;
      const nextTables = body.tables || [];
      const newCount = nextTables.reduce((count, table) => count + (table.items || []).filter((item) => item.status === "NEW").length, 0);
      if (audioEnabled && newCount > previousNewCount.current) playAlert(audioRef);
      previousNewCount.current = newCount;
      setTables(nextTables);
      setRealtimeTopic(body.realtimeTopic || "");
    } catch {}
  }, [audioEnabled, station]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!realtimeTopic) return;
    let unsubscribe = () => {};
    subscribeToBroadcast({
      channel: realtimeTopic,
      event: "refresh",
      onStatus: (status) => {
        setConnection(status);
        if (status === "connected") load();
      },
      onChange: load,
    }).then((cleanup) => { unsubscribe = cleanup; });
    return () => unsubscribe();
  }, [load, realtimeTopic]);

  async function advanceItem(item) {
    setBusyItem(item.id);
    try {
      const next = item.status === "NEW" ? "PREPARING" : item.status === "PREPARING" ? "READY" : "SENT";
      const response = await fetch(`/api/staff/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!response.ok) {
        if ([401, 403].includes(response.status)) window.location.href = "/login";
        return;
      }
      await load();
    } finally {
      setBusyItem(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const tablesWithItems = tables.filter((table) => (table.items || []).length > 0).length;
  const availableTables = tables.filter((table) => !table.sessionId).length;
  const newOrders = tables.filter((table) => (table.items || []).some((item) => item.status === "NEW")).length;
  const connectionLabel = connection === "connected" ? "Realtime" : connection === "reconnecting" ? "Reconectando" : connection === "disabled" ? "Realtime indisponível" : connection === "error" ? "Erro no Realtime" : "Conectando";

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Produção</span><h1>{title}</h1><p>Todas as mesas aparecem no painel; pedidos destinados a {title.toLowerCase()} recebem o estado de produção correspondente.</p></div><div className={styles.actions}><div className={styles.online}><span />{connectionLabel}</div><button onClick={() => { setAudioEnabled(true); initializeAudio(audioRef); }} type="button">{audioEnabled ? "Som ativo" : "Ativar som"}</button><button onClick={logout} type="button">Sair</button></div></header>
    <section className={styles.summary}><div><span>Mesas cadastradas</span><strong>{tables.length}</strong></div><div><span>Mesas livres</span><strong>{availableTables}</strong></div><div><span>Pedidos novos</span><strong>{newOrders}</strong></div></section>
    <section className={styles.board}><div className={styles.boardHeader}><div><h2>Mesas e produção</h2><p>{tables.length ? `${tablesWithItems} mesa(s) com itens nesta estação.` : "Nenhuma mesa ativa cadastrada."}</p></div><div className={styles.legend}><span><i className={styles.newDot}/> Novo</span><span><i className={styles.preparingDot}/> Preparando</span><span><i className={styles.readyDot}/> Pronto</span></div></div><div className={styles.grid}>{tables.map((table) => <TableCard busyItem={busyItem} key={table.tableId || table.sessionId || table.number} onAdvance={advanceItem} station={station} table={table} />)}</div></section>
  </main>;
}

function initializeAudio(ref) {
  if (ref.current || typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) ref.current = new AudioContext();
}

function playAlert(ref) {
  initializeAudio(ref);
  const context = ref.current;
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(.08, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .25);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + .25);
}
