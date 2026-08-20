import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { restSelect } from "@/lib/supabase/server";

export async function GET(_request, { params }) {
  try {
    const { tableCode } = await params;
    const tables = await restSelect("restaurant_tables", {
      public_code: `eq.${tableCode}`,
      active: "eq.true",
      select: "id,restaurant_id,number,status",
      limit: 1,
    }, { admin: true });
    const table = tables?.[0];
    if (!table) return NextResponse.json({ error: "Mesa não encontrada." }, { status: 404 });

    const [categories, products, stations] = await Promise.all([
      restSelect("categories", { restaurant_id: `eq.${table.restaurant_id}`, active: "eq.true", select: "id,name,slug,sort_order", order: "sort_order.asc,name.asc" }, { admin: true }),
      restSelect("products", { restaurant_id: `eq.${table.restaurant_id}`, active: "eq.true", select: "id,category_id,prep_station_id,name,description,price,image_url", order: "name.asc" }, { admin: true }),
      restSelect("prep_stations", { restaurant_id: `eq.${table.restaurant_id}`, active: "eq.true", select: "id,code,name" }, { admin: true }),
    ]);

    const stationMap = Object.fromEntries(stations.map((station) => [station.id, station]));
    return NextResponse.json({
      table: { number: table.number, status: table.status },
      categories,
      products: products.map((product) => ({ ...product, price: Number(product.price), station: stationMap[product.prep_station_id]?.code || null })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível carregar o cardápio.");
  }
}
