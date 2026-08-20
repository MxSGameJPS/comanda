"use client";

import { useEffect, useState } from "react";
import styles from "./void-item-modal.module.css";

export default function VoidItemModal({ item, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setLoading(false);
  }, [item]);

  if (!item) return null;

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await onConfirm({
        item,
        login: String(form.get("login") || "").trim(),
        password: String(form.get("password") || ""),
        reason: String(form.get("reason") || "").trim(),
      });
      onClose();
    } catch (submitError) {
      setError(submitError.message || "Não foi possível cancelar o item.");
    } finally {
      setLoading(false);
    }
  }

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !loading && onClose()}>
    <section aria-modal="true" className={styles.modal} role="dialog">
      <div className={styles.header}><div><span>Cancelamento auditado</span><h2>{item.product_name_snapshot || item.name}</h2></div><button disabled={loading} onClick={onClose} type="button">×</button></div>
      <div className={styles.warning}><strong>Este item não será apagado.</strong><span>Ele ficará como cancelado no histórico, com funcionário, horário e motivo.</span></div>
      <form className={styles.form} onSubmit={submit}>
        <label>Acesso do funcionário<input autoComplete="username" name="login" placeholder="carlos ou carlos@restaurante.com" required/></label>
        <label>Senha<input autoComplete="current-password" name="password" placeholder="••••••••" required type="password"/></label>
        <label>Motivo<textarea maxLength={500} minLength={3} name="reason" placeholder="Ex.: cliente desistiu antes do preparo" required rows={4}/></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}><button className={styles.secondary} disabled={loading} onClick={onClose} type="button">Voltar</button><button className={styles.danger} disabled={loading} type="submit">{loading ? "Validando..." : "Confirmar cancelamento"}</button></div>
      </form>
    </section>
  </div>;
}
