"use client";

import { useState } from "react";
import styles from "./payment-modal.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const methods = [
  ["PIX", "PIX"],
  ["CASH", "Dinheiro"],
  ["DEBIT_CARD", "Cartão de débito"],
  ["CREDIT_CARD", "Cartão de crédito"],
  ["OTHER", "Outro"],
];

export default function PaymentModal({ table, onClose, onConfirm, loading }) {
  const [method, setMethod] = useState("PIX");
  if (!table) return null;
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
    <section aria-modal="true" className={styles.modal} role="dialog">
      <div className={styles.heading}><div><span>Mesa {String(table.number).padStart(2, "0")}</span><h2>Receber conta</h2></div><button disabled={loading} onClick={onClose} type="button">×</button></div>
      <div className={styles.total}><span>Total da comanda</span><strong>{money.format(table.total)}</strong></div>
      <label className={styles.field}>Forma de pagamento<select onChange={(event) => setMethod(event.target.value)} value={method}>{methods.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <p>Ao confirmar, a comanda será encerrada, a mesa ficará livre e o celular do cliente perderá acesso ao pedido.</p>
      <div className={styles.actions}><button disabled={loading} onClick={onClose} type="button">Cancelar</button><button disabled={loading} onClick={() => onConfirm(method)} type="button">{loading ? "Fechando..." : "Confirmar pagamento"}</button></div>
    </section>
  </div>;
}
