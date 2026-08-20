import Link from "next/link";
import TableCard from "@/Components/TableCard/table-card";
import { productionTables } from "@/lib/mock-data";
import styles from "./production-dashboard.module.css";

export default function ProductionDashboard({ station, title }) {
  const relevantTables = productionTables.filter((table) => table.items.some((item) => item.station === station));
  const newOrders = relevantTables.filter((table) => table.items.some((item) => item.station === station && item.status === "NEW")).length;
  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Produção</span><h1>{title}</h1><p>Apenas itens destinados a {title.toLowerCase()} aparecem neste painel.</p></div><div className={styles.actions}><div className={styles.online}><span />Online</div><button type="button">Ativar som</button><Link href="/login">Sair</Link></div></header>
    <section className={styles.summary}><div><span>Mesas com itens</span><strong>{relevantTables.length}</strong></div><div><span>Pedidos novos</span><strong>{newOrders}</strong></div><div><span>Atualização</span><strong>Realtime</strong></div></section>
    <section className={styles.board}><div className={styles.boardHeader}><div><h2>Fila de produção</h2><p>Organizada por mesa e horário de entrada.</p></div><div className={styles.legend}><span><i className={styles.newDot}/> Novo</span><span><i className={styles.preparingDot}/> Preparando</span><span><i className={styles.readyDot}/> Pronto</span></div></div><div className={styles.grid}>{relevantTables.map((table) => <TableCard key={table.number} station={station} table={table} />)}</div></section>
  </main>;
}
