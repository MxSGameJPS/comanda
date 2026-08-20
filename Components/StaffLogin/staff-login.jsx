import Link from "next/link";
import styles from "./staff-login.module.css";

const roleLinks = [{ label: "Garçom", href: "/garcom" },{ label: "Cozinha", href: "/cozinha" },{ label: "Copa", href: "/copa" },{ label: "Caixa", href: "/caixa" }];

export default function StaffLogin() {
  return <main className={styles.page}><section className={styles.panel}>
    <Link className={styles.back} href="/">← Voltar</Link>
    <div className={styles.brand}><span>COMANDA</span><h1>Acesso da equipe</h1><p>Entre com suas credenciais para acessar apenas as áreas autorizadas para sua função.</p></div>
    <form className={styles.form}><label>Usuário ou e-mail<input autoComplete="username" placeholder="seu acesso" /></label><label>Senha<input autoComplete="current-password" placeholder="••••••••" type="password" /></label><button type="button">Entrar</button></form>
    <div className={styles.demo}><span>Atalhos de desenvolvimento</span><div>{roleLinks.map((role) => <Link href={role.href} key={role.href}>{role.label}</Link>)}</div></div>
  </section><aside className={styles.visual}><div><span className={styles.pulse} />Operação em tempo real</div><h2>Uma conta. Uma função. Acesso certo.</h2><p>Garçons, cozinha, copa e caixa trabalham no mesmo fluxo sem expor informações que não pertencem ao setor.</p></aside></main>;
}
