"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./admin-settings.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const roles = [
  ["WAITER", "Garçom"], ["CASHIER", "Caixa"], ["KITCHEN", "Cozinha"], ["BAR", "Copa"], ["MANAGER", "Gerente"], ["ADMIN", "Administrador"],
];

export default function AdminSettings() {
  const [tab, setTab] = useState("tables");
  const [config, setConfig] = useState({ tables: [], categories: [], stations: [], products: [], employees: [], currentRole: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/admin/config", { cache: "no-store" });
      if ([401,403].includes(response.status)) { if (response.status === 401) window.location.href = "/login"; return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar os cadastros.");
      setConfig(body);
      setError("");
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(resource, data, form) {
    setMessage(""); setError("");
    try {
      const response = await fetch("/api/staff/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource, data }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível cadastrar.");
      form?.reset();
      setMessage("Cadastro salvo com sucesso.");
      await load();
    } catch (createError) { setError(createError.message); }
  }

  async function patch(resource, id, data) {
    setMessage(""); setError("");
    try {
      const response = await fetch("/api/staff/admin/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource, id, data }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível atualizar.");
      setMessage("Alteração salva.");
      await load();
    } catch (patchError) { setError(patchError.message); }
  }

  const categoryMap = useMemo(() => Object.fromEntries(config.categories.map((item) => [item.id, item.name])), [config.categories]);
  const stationMap = useMemo(() => Object.fromEntries(config.stations.map((item) => [item.id, item.name])), [config.stations]);

  return <section className={styles.wrapper} id="cadastros">
    <div className={styles.heading}><div><span>Configuração</span><h2>Cadastros do restaurante</h2><p>Mesas, cardápio, setores e acessos ficam sob controle do administrador.</p></div><button onClick={load} type="button">Atualizar</button></div>
    <nav className={styles.tabs}>{[["tables","Mesas"],["catalog","Cardápio"],["employees","Funcionários"]].map(([id,label]) => <button className={tab === id ? styles.activeTab : ""} key={id} onClick={() => setTab(id)} type="button">{label}</button>)}</nav>
    {message && <div className={styles.success}>{message}</div>}
    {error && <div className={styles.error} role="alert">{error}</div>}

    {tab === "tables" && <div className={styles.layout}><form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); create("table", { number: fd.get("number"), label: fd.get("label"), seats: fd.get("seats") }, form); }}><span>Nova mesa</span><h3>Cadastrar mesa</h3><label>Número<input name="number" min="1" required type="number" /></label><label>Identificação opcional<input name="label" placeholder="Varanda, Salão..." /></label><label>Lugares<input name="seats" min="1" type="number" /></label><button type="submit">Criar mesa</button></form>
      <div className={styles.list}><div className={styles.listHeader}><strong>Mesas cadastradas</strong><span>{config.tables.length}</span></div>{config.tables.map((table) => <article className={styles.row} key={table.id}><div className={styles.number}>#{String(table.number).padStart(2,"0")}</div><div><strong>{table.label || `Mesa ${table.number}`}</strong><small>{table.seats ? `${table.seats} lugares · ` : ""}{table.status}</small><code>/m/{table.public_code}</code></div><div className={styles.rowActions}><button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/m/${table.public_code}`)} type="button">Copiar link</button><button className={table.active ? styles.danger : styles.successButton} onClick={() => patch("table", table.id, { active: !table.active })} type="button">{table.active ? "Desativar" : "Ativar"}</button></div></article>)}</div></div>}

    {tab === "catalog" && <div className={styles.catalogGrid}><form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); create("category", { name: fd.get("name") }, form); }}><span>Cardápio</span><h3>Nova categoria</h3><label>Nome<input name="name" required placeholder="Pizzas, Bebidas..." /></label><button type="submit">Criar categoria</button></form>
      <form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); create("station", { code: fd.get("code"), name: fd.get("name") }, form); }}><span>Produção</span><h3>Nova estação</h3><label>Código<input name="code" required placeholder="KITCHEN" /></label><label>Nome<input name="name" required placeholder="Cozinha" /></label><button type="submit">Criar estação</button></form>
      <form className={`${styles.formCard} ${styles.productForm}`} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); create("product", { name: fd.get("name"), description: fd.get("description"), price: fd.get("price"), categoryId: fd.get("categoryId") || null, stationId: fd.get("stationId") || null }, form); }}><span>Produto</span><h3>Novo item do cardápio</h3><label>Nome<input name="name" required /></label><label>Preço<input name="price" min="0" step="0.01" required type="number" /></label><label>Categoria<select name="categoryId"><option value="">Sem categoria</option>{config.categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Destino<select name="stationId"><option value="">Sem estação</option>{config.stations.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={styles.full}>Descrição<input name="description" placeholder="Descrição que aparece no cardápio" /></label><button className={styles.full} type="submit">Cadastrar produto</button></form>
      <div className={`${styles.list} ${styles.fullList}`}><div className={styles.listHeader}><strong>Produtos cadastrados</strong><span>{config.products.length}</span></div>{config.products.map((product) => <article className={styles.row} key={product.id}><div className={styles.productPrice}>{money.format(product.price)}</div><div><strong>{product.name}</strong><small>{categoryMap[product.category_id] || "Sem categoria"} · {stationMap[product.prep_station_id] || "Sem estação"}</small></div><div className={styles.rowActions}><button onClick={() => { const value = window.prompt("Novo preço", String(product.price)); if (value !== null && value !== "") patch("product", product.id, { price: Number(value) }); }} type="button">Preço</button><button className={product.active ? styles.danger : styles.successButton} onClick={() => patch("product", product.id, { active: !product.active })} type="button">{product.active ? "Desativar" : "Ativar"}</button></div></article>)}</div></div>}

    {tab === "employees" && <div className={styles.layout}><form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); create("employee", { name: fd.get("name"), email: fd.get("email"), password: fd.get("password"), loginCode: fd.get("loginCode"), role: fd.get("role"), employmentType: fd.get("employmentType"), activeUntil: fd.get("activeUntil") || null }, form); }}><span>Equipe</span><h3>Novo acesso</h3><label>Nome<input name="name" required /></label><label>E-mail de login<input name="email" required type="email" /></label><label>Senha inicial<input minLength="8" name="password" required type="password" /></label><label>Código curto<input name="loginCode" placeholder="carlos" /></label><label>Função<select name="role">{roles.filter(([role]) => role !== "ADMIN" || config.currentRole === "OWNER").map(([role,label]) => <option key={role} value={role}>{label}</option>)}</select></label><label>Contrato<select name="employmentType"><option value="FIXED">Fixo</option><option value="TEMPORARY">Temporário</option></select></label><label>Validade do acesso<input name="activeUntil" type="datetime-local" /></label><button type="submit">Criar funcionário</button></form>
      <div className={styles.list}><div className={styles.listHeader}><strong>Equipe cadastrada</strong><span>{config.employees.length}</span></div>{config.employees.map((employee) => <article className={styles.row} key={employee.id}><div className={styles.avatar}>{employee.name.split(" ").slice(0,2).map((part) => part[0]).join("")}</div><div><strong>{employee.name}</strong><small>{employee.role} · {employee.login_email || "sem e-mail sincronizado"}</small><code>{employee.login_code || "sem código curto"}</code></div><div className={styles.rowActions}>{employee.role !== "OWNER" && <button className={employee.is_active ? styles.danger : styles.successButton} onClick={() => patch("employee", employee.id, { isActive: !employee.is_active })} type="button">{employee.is_active ? "Desativar" : "Ativar"}</button>}</div></article>)}</div></div>}

    {loading && <div className={styles.loading}>Carregando cadastros...</div>}
  </section>;
}
