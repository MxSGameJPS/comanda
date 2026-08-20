"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSettings from "@/Components/AdminSettings/admin-settings";
import MetricCard from "@/Components/MetricCard/metric-card";
import styles from "./admin-dashboard.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const roleLabels = { OWNER: "Proprietário", ADMIN: "Administrador", MANAGER: "Gerente", CASHIER: "Caixa", WAITER: "Garçom", KITCHEN: "Cozinha", BAR: "Copa" };
const actionLabels = { WAITER_LINKED: "Garçom vinculado", ORDER_CREATED: "Pedido criado", ITEM_REMOVED: "Item cancelado", ITEM_STATUS_CHANGED: "Status do item alterado", TABLE_CLOSED: "Comanda encerrada", PAYMENT_CREATED: "Pagamento registrado" };
const paymentLabels = { PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", OTHER: "Outros" };

export default function AdminDashboard() {
  const [data, setData] = useState({ metrics: {}, paymentMethods: {}, employees: [], audit: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/admin/overview", { cache: "no-store" });
      if ([401, 403].includes(response.status)) { window.location.href = "/login"; return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar o painel.");
      setData(body);
      setError("");
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const interval = window.setInterval(load, 5000); return () => window.clearInterval(interval); }, [load]);

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }

  const paymentTotal = useMemo(() => Object.values(data.paymentMethods || {}).reduce((sum, value) => sum + Number(value || 0), 0), [data.paymentMethods]);
  const today = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date());

  return <main className={styles.page}><aside className={styles.sidebar}><div className={styles.brand}><span>C</span><strong>Comanda</strong></div><nav><a className={styles.active} href="#resumo">Resumo</a><a href="#financeiro">Financeiro</a><a href="#cadastros">Cadastros</a><a href="#funcionarios">Equipe</a><a href="#auditoria">Auditoria</a></nav><button onClick={logout} type="button">Sair</button><Link href="/">← Portal</Link></aside>
    <section className={styles.content}><header className={styles.header}><div><span className={styles.eyebrow}>Gestão</span><h1>Painel administrativo</h1><p>O administrador configura o restaurante e acompanha a operação.</p></div><div className={styles.date}>{today} · Hoje</div></header>
      {error && <div className={styles.feedbackError}>{error}</div>}
      <section className={styles.metrics} id="resumo"><MetricCard detail={`${data.metrics.closedCommands || 0} comandas encerradas`} label="Vendas hoje" tone="accent" value={money.format(Number(data.metrics.sales || 0))}/><MetricCard detail="Comandas encerradas hoje" label="Ticket médio" value={money.format(Number(data.metrics.averageTicket || 0))}/><MetricCard detail="Comandas abertas agora" label="Mesas ocupadas" tone="success" value={String(data.metrics.occupiedTables || 0)}/><MetricCard detail={`${data.metrics.cancellations || 0} itens cancelados`} label="Cancelamentos" tone="danger" value={money.format(Number(data.metrics.cancelledValue || 0))}/></section>
      <AdminSettings />
      <section className={styles.mainGrid}><article className={styles.panel} id="financeiro"><div className={styles.panelHeader}><div><span>Financeiro</span><h2>Recebimentos do dia</h2></div><button onClick={load} type="button">Atualizar</button></div><div className={styles.cashRows}>{Object.entries(paymentLabels).map(([method, label]) => <div key={method}><span>{label}</span><strong>{money.format(Number(data.paymentMethods?.[method] || 0))}</strong></div>)}</div><div className={styles.cashTotal}><span>Total registrado em pagamentos</span><strong>{money.format(paymentTotal)}</strong></div></article>
        <article className={styles.panel} id="funcionarios"><div className={styles.panelHeader}><div><span>Equipe</span><h2>Acessos ativos</h2></div><span className={styles.counter}>{data.employees?.length || 0}</span></div><div className={styles.staffList}>{data.employees?.length ? data.employees.slice(0, 10).map((employee) => <div key={employee.id}><span className={styles.avatar}>{employee.name.split(" ").slice(0,2).map((part) => part[0]).join("").toUpperCase()}</span><p><strong>{employee.name}</strong><small>{roleLabels[employee.role] || employee.role} · {employee.employment_type === "TEMPORARY" ? "Temporário" : "Fixo"}</small></p><i>{employee.active_until ? `Até ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(employee.active_until))}` : "Ativo"}</i></div>) : <p className={styles.emptyState}>{loading ? "Carregando equipe..." : "Nenhum funcionário ativo."}</p>}</div></article></section>
      <section className={styles.panel} id="auditoria"><div className={styles.panelHeader}><div><span>Auditoria</span><h2>Modificações recentes</h2></div><button onClick={load} type="button">Atualizar</button></div><div className={styles.auditTable}><div className={styles.auditHead}><span>Hora</span><span>Tipo</span><span>Alteração</span><span>Responsável</span><span>Motivo</span></div>{data.audit?.length ? data.audit.map((entry) => <div className={styles.auditRow} key={entry.id}><span>{entry.time}</span><strong>{entry.entityType}</strong><span>{actionLabels[entry.action] || entry.action}</span><span>{entry.actor}{entry.actorRole ? ` · ${roleLabels[entry.actorRole] || entry.actorRole}` : ""}</span><span>{entry.reason || "—"}</span></div>) : <p className={styles.emptyState}>{loading ? "Carregando auditoria..." : "Nenhuma modificação registrada."}</p>}</div></section>
    </section></main>;
}
