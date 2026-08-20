import CustomerMenu from "@/Components/CustomerMenu/customer-menu";

export const metadata = {
  title: "Cardápio",
};

export default async function TableMenuPage({ params }) {
  const { tableCode } = await params;

  return <CustomerMenu tableCode={tableCode} />;
}
