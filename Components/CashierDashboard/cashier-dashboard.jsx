"use client";

import { useCallback, useEffect, useState } from "react";
import PaymentModal from "@/Components/PaymentModal/payment-modal";
import { cashierTables as demoTables } from "@/lib/mock-data";
import { subscribeToPostgresChanges } from "@/lib/realtime/client";
import styles from "./cashier-dashboard.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function CashierDashboard() {
  const [tables, setTables] = useState(process.env.NEXT_PUBLIC_ENABLE_DEMO === "true" ? demoTables.map((table, index) => ({ ...table, sessionId: `demo-${index}`, total: table.subtotal, items: [] })) : []);
  const [expanded, setExpanded] = useState(null);
  const [paying, setPaying] = useState(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/cashier", { cache: "no-store" });
      if ([401,403].includes(response.status)) { window.location.href = "/login"; return; }
      const body = await response.json();
      if (response.ok) setTables(body.tables || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    let unsubscribe = () => {};
    subscribeToPostgresChanges({ channel: "cashier-sessions", table: "table_sessions", onChange: load }).then((cleanup) => { unsubscribe = cleanup; });
    const fallback = window.setInterval(load, 3000);
    return () => { unsubscribe(); window.clearInterval(fallback); };
  }, [load]);

  async function closeSession(method) {
    if (!paying || paying.sessionId.startsWith("demo-")) { setPaying(null); return; }
    setLoadingPayment(true);
    try {
      const response = await fetch(`/api/staff/sessions/${paying.sessionId}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method }) });
      if (!response.ok) return;
      setPaying(null);
      await load();
    } finally { setLoadingPayment(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const totalOpen = tables.reduce((sum, table) => sum + Number(table.total ?? table.subtotal ?? 0), 0);
  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Frente de caixa</span><h1>Caixa</h1><p>Comandas, pagamentos e encerramento das mesas.</p></div><div className={styles.headerActions}><div className={styles.online}><span />Caixa aberto</div><button onClick={logout} type="button">Sair</button></div></header>
    <section className={styles.summary}><article><span>Mesas em aberto</span><strong>{tables.length}</strong></article><article><span>Valor em comandas</span><strong>{money.format(totalOpen)}</strong></article><article><span>Aguardando pagamento</span><strong>{tables.filter((table) => table.status === "PAYMENT_PENDING").length}</strong></article></section>
    <section className={styles.content}><div className={styles.sectionTitle}><div><h2>Mesas</h2><p>Selecione uma comanda para conferir ou fechar.</p></div></div><div className={styles.grid}>{tables.map((table) => <article className={styles.card} key={table.sessionId}><div className={styles.cardHeader}><div className={styles.table}><span>Mesa</span><strong>{String(table.number).padStart(2,"0")}</strong></div><span className={table.status === "PAYMENT_PENDING" ? styles.payment : styles.open}>{table.status === "PAYMENT_PENDING" ? "Pagamento" : "Em consumo"}</span></div><div className={styles.details}><div><span>Cliente</span><strong>{table.customer}</strong><small>{table.whatsapp}</small></div><div><span>Atendimento</span><strong>{table.staff?.length ? table.staff.join(" · ") : "Sem garçom vinculado"}</strong><small>Chegada {table.arrival}</small></div></div>
      {expanded === table.sessionId && <div className={styles.itemList}>{table.items?.length ? table.items.map((item) => <div className={styles.itemRow} key={item.id}><div><strong>{item.quantity}× {item.product_name_snapshot}</strong><small>{item.createdBy}{item.observation ? ` · ${item.observation}` : ""}</small></div><span>{money.format(item.total_price)}</span></div>) : <small>Nenhum item lançado.</small>}</div>}
      <div className={styles.total}><span>Total atual</span><strong>{money.format(Number(table.total ?? table.subtotal))}</strong></div><div className={styles.actions}><button className={styles.secondary} onClick={() => setExpanded((current) => current === table.sessionId ? null : table.sessionId)} type="button">{expanded === table.sessionId ? "Ocultar" : "Ver comanda"}</button><button className={styles.primary} onClick={() => setPaying(table)} type="button">Receber conta</button></div></article>)}</div></section>
    <PaymentModal loading={loadingPayment} onClose={() => !loadingPayment && setPaying(null)} onConfirm={closeSession} table={paying} />
  </main>;
}
