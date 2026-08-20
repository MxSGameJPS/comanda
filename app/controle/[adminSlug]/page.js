import { notFound } from "next/navigation";
import AdminDashboard from "@/Components/AdminDashboard/admin-dashboard";

export const metadata = {
  title: "Gestão",
};

export default async function AdminPage({ params }) {
  const { adminSlug } = await params;
  const expectedSlug = process.env.ADMIN_ROUTE_SLUG || "gestao";

  if (adminSlug !== expectedSlug) {
    notFound();
  }

  return <AdminDashboard />;
}
