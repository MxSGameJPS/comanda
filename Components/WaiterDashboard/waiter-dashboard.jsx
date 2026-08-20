"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QrScanner from "@/Components/QrScanner/qr-scanner";
import WaiterOrderModal from "@/Components/WaiterOrderModal/waiter-order-modal";
import styles from "./waiter-dashboard.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function WaiterDashboard() {
  const [employee, setEmployee] = useState(null);
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [linking, setLinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeTable = useMemo(() => tables.find((table) => table.sessionId === activeSessionId) || null, [activeSessionId, tables]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/waiter", { cache: "no-store" });
      if ([401, 403].includes(response.status)) {
        window.location.href = "/login";
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar suas mesas.");
      setEmployee(body.employee || null);
      setTables(body.tables || []);
      setCategories(body.categories || []);
      setProducts(body.products || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 3000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function linkTable(tableCode) {
    if (linking) return;
    setLinking(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/staff/waiter/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível vincular a mesa.");
      await load();
      setActiveSessionId(body.session?.session_id || null);
      setMessage(`Mesa ${String(body.session?.table_number || "").padStart(2, "0")} vinculada ao seu atendimento.`);
    } catch (linkError) {
      setError(linkError.message);
    } finally {
      setLinking(false);
    }
  }

  async function sendOrder(sessionId, items) {
    const response = await fetch("/api/staff/waiter/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, items }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Não foi possível lançar o pedido.");
    await load();
    setMessage("Pedido lançado e encaminhado para produção.");
  }

  async function voidItem({ item, login, password, reason }) {
    const response = await fetch(`/api/staff/items/${item.id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password, reason }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Não foi possível cancelar o item.");
    await load();
    setMessage(`Item cancelado por ${body.authorizedBy?.name || "funcionário autorizado"}.`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Garçom</span><h1>{employee ? `Boa noite, ${employee.name.split(" ")[0]}.` : "Painel do garçom"}</h1><p>Escaneie uma mesa, acompanhe a comanda e faça novos lançamentos.</p></div><button className={styles.exit} onClick={logout} type="button">Sair</button></header>

    <QrScanner busy={linking} onDetected={linkTable}/>
    {message && <div className={styles.success}>{message}</div>}
    {error && <div className={styles.error} role="alert">{error}</div>}

    <section className={styles.section}><div className={styles.sectionTitle}><h2>Minhas mesas</h2><span>{loading ? "Carregando..." : `${tables.length} em atendimento`}</span></div>
      <div className={styles.grid}>{tables.map((table) => <article className={styles.card} key={table.sessionId}><div className={styles.cardTop}><div className={styles.tableNumber}><small>Mesa</small><strong>{String(table.number).padStart(2,"0")}</strong></div><span className={table.status === "PAYMENT_PENDING" ? styles.payment : styles.open}>{table.status === "PAYMENT_PENDING" ? "Aguardando caixa" : "Em atendimento"}</span></div><div className={styles.customer}><span>Cliente</span><strong>{table.customer}</strong><small>{table.whatsapp}</small></div><div className={styles.staff}><span>Atendimento</span><div>{table.staff?.length ? table.staff.join(" · ") : employee?.name}</div></div><div className={styles.cardFooter}><div><span>Total atual</span><strong>{money.format(Number(table.total ?? table.subtotal ?? 0))}</strong></div><button onClick={() => setActiveSessionId(table.sessionId)} type="button">Abrir comanda</button></div></article>)}</div>
      {!loading && !tables.length && <div className={styles.empty}><strong>Nenhuma mesa vinculada.</strong><span>Leia o QR Code de uma mesa com comanda aberta para começar o atendimento.</span></div>}
    </section>

    <WaiterOrderModal categories={categories} onClose={() => setActiveSessionId(null)} onSend={sendOrder} onVoid={voidItem} products={products} table={activeTable}/>
  </main>;
}
