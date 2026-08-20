import Link from "next/link";
import MetricCard from "@/Components/MetricCard/metric-card";
import styles from "./admin-dashboard.module.css";

const changes = [
  { time: "22:14", table: "Mesa 08", action: "2× Cerveja removida", actor: "Carlos Silva · Garçom", reason: "Cliente desistiu" },
  { time: "21:52", table: "Mesa 04", action: "Desconto de R$ 12,00", actor: "Marcelo · Caixa", reason: "Autorização gerencial" },
  { time: "21:18", table: "Mesa 11", action: "1× Pizza alterada", actor: "Pedro · Garçom", reason: "Troca solicitada pelo cliente" },
];

export default function AdminDashboard() {
  return <main className={styles.page}><aside className={styles.sidebar}><div className={styles.brand}><span>C</span><strong>Comanda</strong></div><nav><a className={styles.active} href="#resumo">Resumo</a><a href="#financeiro">Financeiro</a><a href="#mesas">Mesas</a><a href="#produtos">Produtos</a><a href="#funcionarios">Funcionários</a><a href="#auditoria">Auditoria</a></nav><Link href="/">← Portal</Link></aside>
    <section className={styles.content}><header className={styles.header}><div><span className={styles.eyebrow}>Gestão</span><h1>Painel administrativo</h1><p>Visão operacional e financeira do restaurante.</p></div><div className={styles.date}>19 ago · Hoje</div></header>
      <section className={styles.metrics} id="resumo"><MetricCard detail="143 comandas encerradas" label="Vendas hoje" tone="accent" value="R$ 8.420"/><MetricCard detail="+4,8% em relação à semana" label="Ticket médio" value="R$ 58,88"/><MetricCard detail="de 24 mesas" label="Mesas ocupadas" tone="success" value="8"/><MetricCard detail="9 alterações registradas" label="Cancelamentos" tone="danger" value="R$ 132"/></section>
      <section className={styles.mainGrid}><article className={styles.panel} id="financeiro"><div className={styles.panelHeader}><div><span>Financeiro</span><h2>Movimento do caixa</h2></div><button type="button">Ver relatório</button></div><div className={styles.cashRows}><div><span>PIX</span><strong>R$ 3.180,00</strong></div><div><span>Crédito</span><strong>R$ 2.460,00</strong></div><div><span>Débito</span><strong>R$ 1.930,00</strong></div><div><span>Dinheiro</span><strong>R$ 850,00</strong></div></div><div className={styles.cashTotal}><span>Total registrado</span><strong>R$ 8.420,00</strong></div></article>
        <article className={styles.panel} id="funcionarios"><div className={styles.panelHeader}><div><span>Equipe</span><h2>Acessos ativos</h2></div><button type="button">+ Funcionário</button></div><div className={styles.staffList}><div><span className={styles.avatar}>CS</span><p><strong>Carlos Silva</strong><small>Garçom · Fixo</small></p><i>Ativo</i></div><div><span className={styles.avatar}>PS</span><p><strong>Pedro Souza</strong><small>Garçom · Freelancer</small></p><i>Até 03:00</i></div><div><span className={styles.avatar}>MA</span><p><strong>Marcelo Alves</strong><small>Caixa · Fixo</small></p><i>Ativo</i></div></div></article></section>
      <section className={styles.panel} id="auditoria"><div className={styles.panelHeader}><div><span>Auditoria</span><h2>Modificações de comandas</h2></div><button type="button">Filtros</button></div><div className={styles.auditTable}><div className={styles.auditHead}><span>Hora</span><span>Mesa</span><span>Alteração</span><span>Responsável</span><span>Motivo</span></div>{changes.map((change) => <div className={styles.auditRow} key={`${change.time}-${change.table}`}><span>{change.time}</span><strong>{change.table}</strong><span>{change.action}</span><span>{change.actor}</span><span>{change.reason}</span></div>)}</div></section>
    </section></main>;
}
