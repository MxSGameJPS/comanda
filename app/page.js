import SystemHome from "@/Components/SystemHome/system-home";

export default function Home() {
  const adminSlug = process.env.ADMIN_ROUTE_SLUG || "gestao";

  return <SystemHome adminHref={`/controle/${adminSlug}`} />;
}
