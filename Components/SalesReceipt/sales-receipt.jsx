"use client";

import { useState } from "react";
import { printSalesReceipt } from "@/lib/print/sales-receipt";
import styles from "./sales-receipt.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const paymentLabels = { PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito", OTHER: "Outro" };

function numberLabel(value) {
  return String(value || 0).padStart(6, "0");
}

export default function SalesReceipt({ receipt, onClose, mode = "customer" }) {
  const [printError, setPrintError] = useState("");
  if (!receipt) return null;
  const admin = mode === "admin";
  const items = Array.isArray(receipt.items_snapshot) ? receipt.items_snapshot : [];
  const payments = Array.isArray(receipt.payment_snapshot) ? receipt.payment_snapshot : [];
  const staff = Array.isArray(receipt.staff_snapshot) ? receipt.staff_snapshot : [];
  const voids = Array.isArray(receipt.voids_snapshot) ? receipt.voids_snapshot : [];

  function handlePrint() {
    setPrintError("");
    const opened = printSalesReceipt(receipt, { mode });
    if (!opened) {
      setPrintError("O navegador bloqueou a janela de impressão. Libere pop-ups para este site e tente novamente.");
    }
  }

  return <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }} role="presentation">
    <section aria-modal="true" className={styles.modal} role="dialog">
      <div className={styles.heading}><div><span>Comprovante interno</span><h2>#{numberLabel(receipt.receipt_number)}</h2></div><button aria-label="Fechar" onClick={onClose} type="button">×</button></div>
      <div className={styles.paper} id={`receipt-${receipt.id}`}>
        <header className={styles.paperHeader}><strong>COMPROVANTE INTERNO</strong><span>Nº {numberLabel(receipt.receipt_number)}</span><small>SEM VALOR FISCAL</small></header>

        <div className={styles.meta}><div><span>Mesa</span><strong>{String(receipt.table_number || "").padStart(2, "0")}{receipt.table_label ? ` · ${receipt.table_label}` : ""}</strong></div><div><span>Cliente</span><strong>{receipt.customer_name || "Consumidor"}</strong></div>{admin && receipt.customer_whatsapp && <div><span>WhatsApp</span><strong>{receipt.customer_whatsapp}</strong></div>}<div><span>Entrada</span><strong>{receipt.opened_at ? dateTime.format(new Date(receipt.opened_at)) : "—"}</strong></div><div><span>Fechamento</span><strong>{receipt.closed_at ? dateTime.format(new Date(receipt.closed_at)) : "—"}</strong></div></div>

        {staff.length > 0 && <section className={styles.block}><h3>Atendimento</h3>{staff.map((member, index) => <div className={styles.simpleRow} key={`${member.employee_id || member.name}-${index}`}><span>{member.name}</span><small>{member.role || "Equipe"}</small></div>)}</section>}

        <section className={styles.block}><h3>Itens</h3>{items.length ? items.map((item, index) => <div className={styles.itemRow} key={`${item.item_id || item.product_name}-${index}`}><div><strong>{item.quantity}× {item.product_name}</strong>{item.observation && <small>{item.observation}</small>}</div><span>{money.format(Number(item.total_price || 0))}</span></div>) : <p className={styles.empty}>Nenhum item lançado.</p>}</section>

        <section className={styles.totals}><div><span>Subtotal</span><strong>{money.format(Number(receipt.subtotal || 0))}</strong></div>{Number(receipt.discount || 0) > 0 && <div><span>Desconto</span><strong>- {money.format(Number(receipt.discount || 0))}</strong></div>}{Number(receipt.service_fee || 0) > 0 && <div><span>Taxa de serviço</span><strong>{money.format(Number(receipt.service_fee || 0))}</strong></div>}<div className={styles.grandTotal}><span>Total</span><strong>{money.format(Number(receipt.total || 0))}</strong></div></section>

        <section className={styles.block}><h3>Pagamento</h3>{payments.length ? payments.map((payment, index) => <div className={styles.simpleRow} key={`${payment.method}-${index}`}><span>{paymentLabels[payment.method] || payment.method}</span><strong>{money.format(Number(payment.amount || 0))}</strong></div>) : <div className={styles.simpleRow}><span>Sem pagamento registrado</span><strong>{money.format(0)}</strong></div>}</section>

        {admin && voids.length > 0 && <section className={`${styles.block} ${styles.auditBlock}`}><h3>Cancelamentos</h3>{voids.map((item, index) => <div className={styles.voidRow} key={`${item.void_id || item.product_name}-${index}`}><div><strong>{item.quantity}× {item.product_name}</strong><small>{item.reason || "Sem motivo informado"}</small></div><div><span>{money.format(Number(item.total_price || 0))}</span><small>{item.employee_name || "Funcionário"}</small></div></div>)}</section>}

        <footer className={styles.paperFooter}><span>Fechado por: {receipt.closed_by_name || "Sistema"}</span><strong>DOCUMENTO INTERNO · SEM VALOR FISCAL</strong></footer>
      </div>
      {printError && <p className={styles.printError} role="alert">{printError}</p>}
      <div className={styles.actions}><button onClick={onClose} type="button">Fechar</button><button className={styles.print} onClick={handlePrint} type="button">Imprimir cupom</button></div>
    </section>
  </div>;
}
