import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restSelect } from "@/lib/supabase/server";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" });

export async function GET() {
  try {
    const { profile } = await requireStaff(["CASHIER", "MANAGER", "ADMIN", "OWNER"]);
    const restaurantId = profile.restaurant_id;
    const [categories, stations, products, sessions, restaurantTables] = await Promise.all([
      restSelect("categories", { restaurant_id: `eq.${restaurantId}`, active: "eq.true", select: "id,name,slug,sort_order", order: "sort_order.asc" }, { admin: true }),
      restSelect("prep_stations", { restaurant_id: `eq.${restaurantId}`, active: "eq.true", select: "id,code,name" }, { admin: true }),
      restSelect("products", { restaurant_id: `eq.${restaurantId}`, active: "eq.true", select: "id,category_id,prep_station_id,name,description,price,image_url", order: "name.asc" }, { admin: true }),
      restSelect("table_sessions", { restaurant_id: `eq.${restaurantId}`, status: "in.(OPEN,PAYMENT_PENDING)", select: "id,table_id,customer_name,customer_whatsapp,status,opened_at,subtotal,discount,service_fee,total", order: "opened_at.asc" }, { admin: true }),
      restSelect("restaurant_tables", { restaurant_id: `eq.${restaurantId}`, active: "eq.true", select: "id,number,label,status", order: "number.asc" }, { admin: true }),
    ]);

    const stationMap = Object.fromEntries(stations.map((station) => [station.id, station]));
    const normalizedProducts = products.map((product) => ({ ...product, price: Number(product.price), station: stationMap[product.prep_station_id]?.code || "NONE" }));
    const sessionMap = new Map(sessions.map((session) => [session.table_id, session]));
    const sessionIds = sessions.map((session) => session.id);
    let items = [];
    let links = [];

    if (sessionIds.length) {
      [items, links] = await Promise.all([
        restSelect("order_items", { session_id: `in.(${sessionIds.join(",")})`, status: "neq.CANCELLED", select: "id,session_id,product_name_snapshot,quantity,unit_price,total_price,status,source,created_by_employee_id,observation,created_at" }, { admin: true }),
        restSelect("session_staff", { session_id: `in.(${sessionIds.join(",")})`, select: "session_id,employee_id,linked_at" }, { admin: true }),
      ]);
    }

    const employeeIds = [...new Set([...links.map((link) => link.employee_id), ...items.map((item) => item.created_by_employee_id).filter(Boolean)])];
    const employees = employeeIds.length ? await restSelect("employee_profiles", { id: `in.(${employeeIds.join(",")})`, select: "id,name,role" }, { admin: true }) : [];
    const employeeMap = Object.fromEntries(employees.map((employee) => [employee.id, employee]));

    const tables = restaurantTables.map((table) => {
      const session = sessionMap.get(table.id) || null;
      if (!session) {
        return {
          tableId: table.id,
          sessionId: null,
          number: table.number,
          label: table.label,
          status: "AVAILABLE",
          tableStatus: table.status,
          customer: null,
          whatsapp: null,
          arrival: null,
          subtotal: 0,
          discount: 0,
          serviceFee: 0,
          total: 0,
          staff: [],
          items: [],
        };
      }

      return {
        tableId: table.id,
        sessionId: session.id,
        number: table.number,
        label: table.label,
        status: session.status,
        tableStatus: table.status,
        customer: session.customer_name,
        whatsapp: session.customer_whatsapp,
        arrival: timeFormatter.format(new Date(session.opened_at)),
        subtotal: Number(session.subtotal),
        discount: Number(session.discount),
        serviceFee: Number(session.service_fee),
        total: Number(session.total),
        staff: links.filter((link) => link.session_id === session.id).map((link) => employeeMap[link.employee_id]?.name).filter(Boolean),
        items: items.filter((item) => item.session_id === session.id).map((item) => ({ ...item, unit_price: Number(item.unit_price), total_price: Number(item.total_price), createdBy: employeeMap[item.created_by_employee_id]?.name || (item.source === "CUSTOMER" ? "Cliente" : null) })),
      };
    });

    return NextResponse.json({ categories, products: normalizedProducts, tables }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Não foi possível carregar as comandas.");
  }
}
