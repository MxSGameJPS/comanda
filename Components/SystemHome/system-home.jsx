import Link from "next/link";
import styles from "./system-home.module.css";

const staffAreas = [
  { title: "Garçom", description: "Mesas atendidas, leitura do QR e inclusão de itens.", href: "/garcom", badge: "G" },
  { title: "Cozinha", description: "Fila de preparo apenas com itens da cozinha.", href: "/cozinha", badge: "CZ" },
  { title: "Copa", description: "Fila de bebidas e itens destinados à copa.", href: "/copa", badge: "CP" },
  { title: "Caixa", description: "Comandas completas, pagamentos e fechamento.", href: "/caixa", badge: "CX" },
];

export default function SystemHome({ adminHref }) {
  const demoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO === "true";
  const areas = demoEnabled ? [
    { title: "Cliente · Demo", description: "Atalho de desenvolvimento para o cardápio demonstrativo.", href: "/m/demo", badge: "QR" },
    ...staffAreas,
  ] : staffAreas;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Restaurant operations</span>
          <h1>Comanda</h1>
          <p>Um único sistema para autoatendimento, equipe, produção, caixa e gestão.</p>
        </div>
        <Link className={styles.login} href="/login">Acesso da equipe</Link>
      </section>

      <section className={styles.flow} aria-label="Fluxo operacional">
        <span>Cliente por QR</span><i>→</i><span>Produção</span><i>→</i><span>Atendimento</span><i>→</i><span>Caixa</span>
      </section>

      <section className={styles.grid}>
        {areas.map((area) => (
          <Link className={styles.card} href={area.href} key={area.title}>
            <div className={styles.badge}>{area.badge}</div>
            <div><h2>{area.title}</h2><p>{area.description}</p></div>
            <span className={styles.arrow}>↗</span>
          </Link>
        ))}
        {demoEnabled && <Link className={`${styles.card} ${styles.adminCard}`} href={adminHref}>
          <div className={styles.badge}>AD</div>
          <div><h2>Administração</h2><p>Financeiro, funcionários, produtos, auditoria e indicadores.</p></div>
          <span className={styles.arrow}>↗</span>
        </Link>}
      </section>

      <footer className={styles.footer}><span className={styles.dot} />Cliente real por QR · Next.js 16 · PWA</footer>
    </main>
  );
}
