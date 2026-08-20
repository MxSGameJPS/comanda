"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import styles from "./staff-login.module.css";

const roleLinks = [
  { label: "Garçom", href: "/garcom" },
  { label: "Cozinha", href: "/cozinha" },
  { label: "Copa", href: "/copa" },
  { label: "Caixa", href: "/caixa" },
];

export default function StaffLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const demoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO === "true";

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível entrar.");

      const requested = searchParams.get("next");
      const redirectTo = requested?.startsWith("/") ? requested : body.redirectTo;
      router.replace(redirectTo);
      router.refresh();
    } catch (loginError) {
      setError(loginError.message);
      setLoading(false);
    }
  }

  return <main className={styles.page}>
    <section className={styles.panel}>
      <Link className={styles.back} href="/">← Voltar</Link>
      <div className={styles.brand}><span>COMANDA</span><h1>Acesso da equipe</h1><p>Entre com suas credenciais para acessar apenas as áreas autorizadas para sua função.</p></div>
      <form className={styles.form} onSubmit={login}>
        <label>E-mail<input autoComplete="username" name="email" placeholder="nome@restaurante.com" required type="email" /></label>
        <label>Senha<input autoComplete="current-password" name="password" placeholder="••••••••" required type="password" /></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button disabled={loading} type="submit">{loading ? "Entrando..." : "Entrar"}</button>
      </form>
      {demoEnabled && <div className={styles.demo}><span>Atalhos visuais de desenvolvimento</span><div>{roleLinks.map((role) => <Link href={role.href} key={role.href}>{role.label}</Link>)}</div></div>}
    </section>
    <aside className={styles.visual}><div><span className={styles.pulse} />Operação conectada</div><h2>Uma conta. Uma função. Acesso certo.</h2><p>Garçons, cozinha, copa e caixa trabalham no mesmo fluxo sem expor informações que não pertencem ao setor.</p></aside>
  </main>;
}
