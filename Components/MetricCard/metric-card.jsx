import styles from "./metric-card.module.css";

export default function MetricCard({ label, value, detail, tone = "default" }) {
  return <article className={`${styles.card} ${styles[tone] || ""}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}
