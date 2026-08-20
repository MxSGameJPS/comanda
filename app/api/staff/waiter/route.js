import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restSelect } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { profile } = await requireStaff(["WAITER", "MANAGER", "ADMIN", "OWNER"]);

    const [categories, stations, products, links] = await Promise.all([
      restSelect("categories", { restaurant_id: `eq.${profile.restaurant_id}`, active: "eq.true", select: "id,name,slug,sort_order", order: "sort_order.asc" }, { admin: true }),
      restSelect("prep_stations", { restaurant_id: `eq.${profile.restaurant_id}`, active: "eq.true", select: "id,code,name" }, { admin: true }),
      restSelect("products", { restaurant_id: `eq.${profile.restaurant_id}`, active: "eq.true", select: "id,category_id,prep_station_id,name,description,price,image_url", order: "name.asc" }, { admin: true }),
      restSelect("session_staff", { employee_id: `eq.${profile.id}`, select: "session_id,linked_at", order: "linked_at.desc" }, { admin: true }),
    ]);

    const stationMap = Object.fromEntries(stations.map((station) => [station.id, station]));
    const normalizedProducts = products.map((product) => ({ ...product, price: Number(product.price), station: stationMap[product.prep_station_id]?.code || "NONE" }));
    const sessionIds = [...new Set(links.map((link) => link.session_id))];

    if (!sessionIds.length) {
      return NextResponse.json({ employee: { id: profile.id, name: profile.name, role: profile.role }, categories, products: normalizedProducts, tables: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const sessions = await restSelect("table_sessions", { id: `in.(${sessionIds.join(",")})`, status: "in.(OPEN,PAYMENT_PENDING)", select: "id,table_id,customer_name,customer_whatsapp,status,opened_at,subtotal,total", order: "opened_at.asc" }, { admin: true });
    if (!sessions.length) {
      return NextResponse.json({ employee: { id: profile.id, name: profile.name, role: profile.role }, categories, products: normalizedProducts, tables: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const activeSessionIds = sessions.map((session) => session.id);
    const tableIds = [...new Set(sessions.map((session) => session.table_id))];
    const [tables, items, allLinks] = await Promise.all([
      restSelect("restaurant_tables", { id: `in.(${tableIds.join(",")})`, select: "id,number,public_code" }, { admin: true }),
      restSelect("order_items", { session_id: `in.(${activeSessionIds.join(",")})`, status: "neq.CANCELLED", select: "id,session_id,product_name_snapshot,quantity,unit_price,total_price,observation,status,source,created_by_employee_id,created_at", order: "created_at.asc" }, { admin: true }),
      restSelect("session_staff", { session_id: `in.(${activeSessionIds.join(",")})`, select: "session_id,employee_id,linked_at" }, { admin: true }),
    ]);

    const employeeIds = [...new Set(allLinks.map((link) => link.employee_id))];
    const employees = employeeIds.length ? await restSelect("employee_profiles", { id: `in.(${employeeIds.join(",")})`, select: "id,name,role" }, { admin: true }) : [];
    const employeeMap = Object.fromEntries(employees.map((employee) => [employee.id, employee]));
    const tableMap = Object.fromEntries(tables.map((table) => [table.id, table]));

    const result = sessions.map((session) => ({
      sessionId: session.id,
      number: tableMap[session.table_id]?.number,
      publicCode: tableMap[session.table_id]?.public_code,
      customer: session.customer_name,
      whatsapp: session.customer_whatsapp,
      status: session.status,
      openedAt: session.opened_at,
      subtotal: Number(session.subtotal),
      total: Number(session.total),
      staff: allLinks.filter((link) => link.session_id === session.id).map((link) => employeeMap[link.employee_id]?.name).filter(Boolean),
      items: items.filter((item) => item.session_id === session.id).map((item) => ({ ...item, unit_price: Number(item.unit_price), total_price: Number(item.total_price) })),
    }));

    return NextResponse.json({ employee: { id: profile.id, name: profile.name, role: profile.role }, categories, products: normalizedProducts, tables: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível carregar as mesas do garçom.");
  }
}
