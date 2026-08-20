import styles from "./table-card.module.css";

const statusLabels = { NEW: "Novo pedido", PREPARING: "Em preparo", READY: "Pronto" };

export default function TableCard({ table, station }) {
  const items = table.items.filter((item) => item.station === station);
  if (!items.length) return null;
  const effectiveStatus = items.some((item) => item.status === "NEW") ? "NEW" : items.some((item) => item.status === "PREPARING") ? "PREPARING" : "READY";

  return <article className={`${styles.card} ${styles[effectiveStatus.toLowerCase()]}`}>
    <div className={styles.header}><div><span>Mesa</span><strong>{String(table.number).padStart(2, "0")}</strong></div><div className={styles.meta}><span>{statusLabels[effectiveStatus]}</span><small>Pedido {table.openedAt}</small></div></div>
    <div className={styles.items}>{items.map((item) => <div className={styles.item} key={item.id}><strong>{item.quantity}×</strong><div><b>{item.name}</b>{item.observation && <small>{item.observation}</small>}</div></div>)}</div>
    <div className={styles.actions}><button className={styles.print} type="button">Imprimir</button><button className={styles.primary} type="button">{effectiveStatus === "NEW" ? "Iniciar preparo" : effectiveStatus === "PREPARING" ? "Marcar como pronto" : "Enviado à mesa"}</button></div>
  </article>;
}
