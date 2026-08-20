"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./first-admin-setup.module.css";

export default function FirstAdminSetup() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/setup/admin", { cache: "no-store" }).then((response) => response.json()).then(setStatus).catch(() => setStatus({ error: true }));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/setup/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupKey: form.get("setupKey"),
          restaurantName: form.get("restaurantName"),
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível concluir a configuração.");
      window.location.href = body.redirectTo;
    } catch (submitError) {
      setError(submitError.message);
      setLoading(false);
    }
  }

  if (!status) return <main className={styles.page}><section className={styles.card}><span>COMANDA</span><h1>Preparando configuração...</h1></section></main>;
  if (status.hasAdmin) return <main className={styles.page}><section className={styles.card}><span>COMANDA</span><h1>Administrador já configurado.</h1><p>O primeiro acesso está encerrado. Entre com o e-mail e a senha do administrador.</p><Link className={styles.primaryLink} href="/login">Ir para o login</Link></section></main>;

  return <main className={styles.page}><section className={styles.card}><span>PRIMEIRO ACESSO</span><h1>Configure o restaurante.</h1><p>Crie o proprietário do sistema. Esse usuário terá acesso total ao painel administrativo.</p>
    {!status.setupKeyConfigured && <div className={styles.warning}>Defina <strong>ADMIN_SETUP_KEY</strong> no servidor antes de continuar.</div>}
    <form onSubmit={submit} className={styles.form}>
      <label>Nome do restaurante<input name="restaurantName" required placeholder="Ex.: Restaurante da Serra" /></label>
      <label>Nome do administrador<input name="name" required placeholder="Nome completo" /></label>
      <label>E-mail de login<input autoComplete="username" name="email" type="email" required placeholder="admin@restaurante.com" /></label>
      <label>Senha do administrador<input autoComplete="new-password" name="password" type="password" minLength={8} required placeholder="Mínimo 8 caracteres" /></label>
      <label>Chave de instalação<input name="setupKey" type="password" required placeholder="ADMIN_SETUP_KEY" /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button disabled={loading || !status.setupKeyConfigured} type="submit">{loading ? "Criando administrador..." : "Criar administrador e entrar"}</button>
    </form>
    <small>A senha é armazenada pelo Supabase Auth, não na tabela de funcionários.</small>
  </section></main>;
}
