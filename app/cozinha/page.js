import ProductionDashboard from "@/Components/ProductionDashboard/production-dashboard";

export const metadata = {
  title: "Cozinha",
};

export default function KitchenPage() {
  return <ProductionDashboard station="KITCHEN" title="Cozinha" />;
}
