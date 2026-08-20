"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PaymentModal from "@/Components/PaymentModal/payment-modal";
import SalesReceipt from "@/Components/SalesReceipt/sales-receipt";
import VoidItemModal from "@/Components/VoidItemModal/void-item-modal";
import WaiterOrderModal from "@/Components/WaiterOrderModal/waiter-order-modal";
import { cashierTables as demoTables } from "@/lib/mock-data";
import { subscribeToBroadcast } from "@/lib/realtime/client";
import styles from "./cashier-dashboard.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const paymentLabels = { PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", OTHER: "Outro" };

export default function CashierDashboard() {
  const [tables, setTables] = useState(process.env.NEXT_PUBLIC_ENABLE_DEMO === "true" ? demoTables.map((table, index) => ({ ...table, tableId: `demo-table-${index}`, sessionId: `demo-${index}`, total: table.subtotal, items: [] })) : []);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [connection, setConnection] = useState("connecting");
  const [realtimeTopic, setRealtimeTopic] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [paying, setPaying] = useState(null);
  const [voidingItem, setVoidingItem] = useState(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editingTable = useMemo(() => editingSessionId ? tables.find((table) => table.sessionId === editingSessionId) || null : null, [editingSessionId, tables]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/cashier", { cache: "no-store" });
      if ([401,403].includes(response.status)) { window.location.href = "/login"; return; }
      const body = await response.json();
      if (response.ok) {
        setTables(body.tables || []);
        setCategories(body.categories || []);
        setProducts(body.products || []);
        setReceipts(body.receipts || []);
        setRealtimeTopic(body.realtimeTopic || "");
      }
    } catch {}
  }, []);

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

  async function closeSession(method) {
    if (!paying || !paying.sessionId || paying.sessionId.startsWith("demo-")) { setPaying(null); return; }
    setLoadingPayment(true);
    setError("");
    try {
      const response = await fetch(`/api/staff/sessions/${paying.sessionId}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível fechar a comanda.");
      setPaying(null);
      setEditingSessionId(null);
      setReceipt(body.receipt || null);
      setMessage(body.receipt ? `Pagamento registrado. Comprovante interno #${String(body.receipt.receipt_number).padStart(6,"0")} gerado.` : "Pagamento registrado e mesa liberada.");
      await load();
    } catch (closeError) {
      setError(closeError.message);
    } finally { setLoadingPayment(false); }
  }

  async function openReceipt(receiptId) {
    setError("");
    try {
      const response = await fetch(`/api/staff/receipts/${receiptId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível abrir o comprovante.");
      setReceipt(body.receipt);
    } catch (receiptError) { setError(receiptError.message); }
  }

  async function sendOrder(sessionId, items) {
    const response = await fetch("/api/staff/cashier/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, items }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Não foi possível lançar o item pelo caixa.");
    setMessage("Lançamento do caixa adicionado à comanda.");
    setError("");
    await load();
  }

  async function voidItem({ item, login, password, reason }) {
    const response = await fetch(`/api/staff/items/${item.id}/void`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password, reason }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Não foi possível cancelar o item.");
    setMessage(`Item cancelado por ${body.authorizedBy?.name || "funcionário autorizado"}.`);
    setError("");
    await load();
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }

  const openTables = tables.filter((table) => Boolean(table.sessionId));
  const availableTables = tables.filter((table) => !table.sessionId);
  const totalOpen = openTables.reduce((sum, table) => sum + Number(table.total ?? table.subtotal ?? 0), 0);
  const connectionLabel = connection === "connected" ? "Realtime" : connection === "reconnecting" ? "Reconectando" : connection === "disabled" ? "Realtime indisponível" : connection === "error" ? "Erro no Realtime" : "Conectando";

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Frente de caixa</span><h1>Caixa</h1><p>Comandas, pagamentos, comprovantes e encerramento das mesas.</p></div><div className={styles.headerActions}><div className={styles.online}><span />{connectionLabel}</div><button onClick={logout} type="button">Sair</button></div></header>
    {message && <div className={styles.feedbackSuccess}>{message}</div>}
    {error && <div className={styles.feedbackError} role="alert">{error}</div>}
    <section className={styles.summary}><article><span>Mesas em aberto</span><strong>{openTables.length}</strong></article><article><span>Mesas livres</span><strong>{availableTables.length}</strong></article><article><span>Valor em comandas</span><strong>{money.format(totalOpen)}</strong></article></section>
    <section className={styles.content}><div className={styles.sectionTitle}><div><h2>Mesas</h2><p>Todas as mesas ativas do restaurante aparecem aqui, inclusive as livres.</p></div></div><div className={styles.grid}>{tables.map((table) => {
      const isAvailable = !table.sessionId;
      const cardState = isAvailable ? styles.availableCard : table.status === "PAYMENT_PENDING" ? styles.paymentCard : styles.openCard;
      return <article className={`${styles.card} ${cardState}`} key={table.tableId || table.sessionId}><div className={styles.cardHeader}><div className={styles.table}><span>Mesa</span><strong>{String(table.number).padStart(2,"0")}</strong>{table.label && <small>{table.label}</small>}</div><span className={isAvailable ? styles.available : table.status === "PAYMENT_PENDING" ? styles.payment : styles.open}>{isAvailable ? "Livre" : table.status === "PAYMENT_PENDING" ? "Pagamento" : "Em consumo"}</span></div>
        {isAvailable ? <div className={styles.availableBody}><strong>Mesa disponível</strong><span>Sem comanda aberta no momento.</span></div> : <><div className={styles.details}><div><span>Cliente</span><strong>{table.customer}</strong><small>{table.whatsapp}</small></div><div><span>Atendimento</span><strong>{table.staff?.length ? table.staff.join(" · ") : "Sem garçom vinculado"}</strong><small>Chegada {table.arrival}</small></div></div>
        {expanded === table.sessionId && <div className={styles.itemList}>{table.items?.length ? table.items.map((item) => <div className={styles.itemRow} key={item.id}><div><strong>{item.quantity}× {item.product_name_snapshot}</strong><small>{item.createdBy}{item.observation ? ` · ${item.observation}` : ""}</small></div><div className={styles.itemActions}><span>{money.format(item.total_price)}</span><button onClick={() => setVoidingItem(item)} type="button">Cancelar</button></div></div>) : <small>Nenhum item lançado.</small>}</div>}
        <div className={styles.total}><span>Total atual</span><strong>{money.format(Number(table.total ?? table.subtotal))}</strong></div><div className={styles.actions}><button className={styles.secondary} onClick={() => setExpanded((current) => current === table.sessionId ? null : table.sessionId)} type="button">{expanded === table.sessionId ? "Ocultar" : "Ver comanda"}</button><button className={styles.secondary} disabled={table.status !== "OPEN"} onClick={() => setEditingSessionId(table.sessionId)} type="button">+ Item</button><button className={styles.primary} onClick={() => setPaying(table)} type="button">Receber</button></div></>}
      </article>;
    })}</div>
      <div className={styles.sectionTitle}><div><h2>Últimos comprovantes</h2><p>Reimprima uma venda já encerrada se o cliente solicitar.</p></div></div>
      <div className={styles.receiptList}>{receipts.length ? receipts.map((item) => <button className={styles.receiptRow} key={item.id} onClick={() => openReceipt(item.id)} type="button"><span><strong>#{String(item.receipt_number).padStart(6,"0")}</strong><small>Mesa {String(item.table_number).padStart(2,"0")} · {item.customer_name}</small></span><span><strong>{money.format(Number(item.total || 0))}</strong><small>{item.closed_at ? dateTime.format(new Date(item.closed_at)) : "—"} · {paymentLabels[item.payment_snapshot?.[0]?.method] || "Pagamento"}</small></span></button>) : <div className={styles.noReceipts}>Nenhum comprovante interno gerado ainda.</div>}</div>
    </section>
    <PaymentModal loading={loadingPayment} onClose={() => !loadingPayment && setPaying(null)} onConfirm={closeSession} table={paying} />
    <VoidItemModal item={voidingItem} onClose={() => setVoidingItem(null)} onConfirm={voidItem}/>
    <WaiterOrderModal categories={categories} onClose={() => setEditingSessionId(null)} onSend={sendOrder} onVoid={voidItem} products={products} table={editingTable}/>
    <SalesReceipt mode="customer" onClose={() => setReceipt(null)} receipt={receipt}/>
  </main>;
}
