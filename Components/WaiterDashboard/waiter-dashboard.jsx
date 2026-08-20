import Link from "next/link";
import { waiterTables } from "@/lib/mock-data";
import styles from "./waiter-dashboard.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function WaiterDashboard() {
  return <main className={styles.page}><header className={styles.header}><div><span className={styles.eyebrow}>Garçom</span><h1>Boa noite, Carlos.</h1><p>Mesas vinculadas ao seu atendimento neste turno.</p></div><Link className={styles.exit} href="/login">Sair</Link></header>
    <section className={styles.scanner}><div className={styles.scanIcon}><i/><i/><i/><i/></div><div><strong>Ler QR Code da mesa</strong><span>Vincule-se à mesa e abra a comanda para adicionar novos itens.</span></div><button type="button">Abrir câmera</button></section>
    <section className={styles.section}><div className={styles.sectionTitle}><h2>Minhas mesas</h2><span>{waiterTables.length} em atendimento</span></div><div className={styles.grid}>{waiterTables.map((table) => <article className={styles.card} key={table.number}><div className={styles.cardTop}><div className={styles.tableNumber}><small>Mesa</small><strong>{String(table.number).padStart(2,"0")}</strong></div><span className={table.status === "PAYMENT_PENDING" ? styles.payment : styles.open}>{table.status === "PAYMENT_PENDING" ? "Aguardando caixa" : "Em atendimento"}</span></div><div className={styles.customer}><span>Cliente</span><strong>{table.customer}</strong></div><div className={styles.staff}><span>Atendimento</span><div>{table.staff.join(" · ")}</div></div><div className={styles.cardFooter}><div><span>Subtotal</span><strong>{money.format(table.subtotal)}</strong></div><button type="button">Abrir comanda</button></div></article>)}</div></section>
  </main>;
}
