import Link from "next/link";
import { cashierTables } from "@/lib/mock-data";
import styles from "./cashier-dashboard.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function CashierDashboard() {
  const totalOpen = cashierTables.reduce((sum, table) => sum + table.subtotal, 0);
  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Frente de caixa</span><h1>Caixa</h1><p>Comandas, pagamentos e encerramento das mesas.</p></div><div className={styles.headerActions}><div className={styles.online}><span />Caixa aberto</div><Link href="/login">Sair</Link></div></header>
    <section className={styles.summary}><article><span>Mesas em aberto</span><strong>{cashierTables.length}</strong></article><article><span>Valor em comandas</span><strong>{money.format(totalOpen)}</strong></article><article><span>Aguardando pagamento</span><strong>{cashierTables.filter((table) => table.status === "PAYMENT_PENDING").length}</strong></article></section>
    <section className={styles.content}><div className={styles.sectionTitle}><div><h2>Mesas</h2><p>Selecione uma comanda para conferir ou fechar.</p></div><button type="button">+ Lançamento manual</button></div><div className={styles.grid}>{cashierTables.map((table) => <article className={styles.card} key={table.number}><div className={styles.cardHeader}><div className={styles.table}><span>Mesa</span><strong>{String(table.number).padStart(2,"0")}</strong></div><span className={table.status === "PAYMENT_PENDING" ? styles.payment : styles.open}>{table.status === "PAYMENT_PENDING" ? "Pagamento" : "Em consumo"}</span></div><div className={styles.details}><div><span>Cliente</span><strong>{table.customer}</strong><small>{table.whatsapp}</small></div><div><span>Atendimento</span><strong>{table.staff.join(" · ")}</strong><small>Chegada {table.arrival} · Entrega {table.delivered}</small></div></div><div className={styles.total}><span>Total atual</span><strong>{money.format(table.subtotal)}</strong></div><div className={styles.actions}><button className={styles.secondary} type="button">Ver comanda</button><button className={styles.primary} type="button">Receber conta</button></div></article>)}</div></section>
  </main>;
}
