import styles from "./table-card.module.css";

const statusLabels = {
  AVAILABLE: "Mesa livre",
  OCCUPIED: "Em consumo",
  NEW: "Novo pedido",
  PREPARING: "Em preparo",
  READY: "Pronto",
};

export default function TableCard({ table, station, onAdvance, busyItem }) {
  const items = (table.items || []).filter((item) => item.station === station);
  const effectiveStatus = items.length
    ? items.some((item) => item.status === "NEW")
      ? "NEW"
      : items.some((item) => item.status === "PREPARING")
        ? "PREPARING"
        : "READY"
    : table.sessionId
      ? "OCCUPIED"
      : "AVAILABLE";
  const actionable = items.find((item) => item.status === effectiveStatus);
  const isOperational = items.length > 0;

  return <article className={`${styles.card} ${styles[effectiveStatus.toLowerCase()]}`}>
    <div className={styles.header}><div><span>Mesa</span><strong>{String(table.number).padStart(2, "0")}</strong>{table.label && <small className={styles.tableLabel}>{table.label}</small>}</div><div className={styles.meta}><span>{statusLabels[effectiveStatus]}</span>{table.openedAt ? <small>Aberta {table.openedAt}</small> : <small>Sem comanda aberta</small>}</div></div>
    {isOperational ? <div className={styles.items}>{items.map((item) => <div className={styles.item} key={item.id}><strong>{item.quantity}×</strong><div><b>{item.name}</b>{item.observation && <small>{item.observation}</small>}</div><span>{statusLabels[item.status] || item.status}</span></div>)}</div> : <div className={styles.empty}><strong>{effectiveStatus === "AVAILABLE" ? "Disponível" : "Sem itens nesta estação"}</strong><span>{effectiveStatus === "AVAILABLE" ? "Aguardando cliente abrir uma comanda." : `A mesa está em consumo, mas não há itens para ${station === "KITCHEN" ? "a cozinha" : "a copa"}.`}</span></div>}
    {isOperational && <div className={styles.actions}><button className={styles.print} onClick={() => window.print()} type="button">Imprimir</button><button className={styles.primary} disabled={!actionable || busyItem === actionable?.id} onClick={() => actionable && onAdvance?.(actionable)} type="button">{busyItem === actionable?.id ? "Atualizando..." : effectiveStatus === "NEW" ? "Iniciar preparo" : effectiveStatus === "PREPARING" ? "Marcar como pronto" : "Enviado à mesa"}</button></div>}
  </article>;
}
