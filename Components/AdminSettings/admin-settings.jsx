"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TableQr from "@/Components/TableQr/table-qr";
import styles from "./admin-settings.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const roles = [
  ["WAITER", "Garçom"], ["CASHIER", "Caixa"], ["KITCHEN", "Cozinha"], ["BAR", "Copa"], ["MANAGER", "Gerente"], ["ADMIN", "Administrador"],
];

export default function AdminSettings() {
  const [tab, setTab] = useState("tables");
  const [config, setConfig] = useState({ tables: [], categories: [], stations: [], products: [], employees: [], currentRole: "" });
  const [loading, setLoading] = useState(true);
  const [uploadingProductId, setUploadingProductId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/admin/config", { cache: "no-store" });
      if ([401, 403].includes(response.status)) { if (response.status === 401) window.location.href = "/login"; return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar os cadastros.");
      setConfig(body);
      setError("");
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(resource, data, form, { reset = true, successMessage = "Cadastro salvo com sucesso." } = {}) {
    setMessage(""); setError("");
    try {
      const response = await fetch("/api/staff/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource, data }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível cadastrar.");
      if (reset) form?.reset();
      setMessage(successMessage);
      await load();
      return body.item || null;
    } catch (createError) { setError(createError.message); return null; }
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

  async function uploadProductImage(productId, file, { reload = true } = {}) {
    if (!file) return false;
    if (!file.type.startsWith("image/")) { setError("Selecione um arquivo de imagem."); return false; }
    if (file.size > 5 * 1024 * 1024) { setError("A imagem deve ter no máximo 5 MB."); return false; }

    setUploadingProductId(productId);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch(`/api/staff/admin/products/${productId}/image`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível enviar a imagem.");
      setMessage("Imagem do produto salva.");
      if (reload) await load();
      return true;
    } catch (uploadError) {
      setError(uploadError.message);
      return false;
    } finally {
      setUploadingProductId(null);
    }
  }

  async function createProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const item = await create("product", {
      name: fd.get("name"),
      description: fd.get("description"),
      price: fd.get("price"),
      categoryId: fd.get("categoryId") || null,
      stationId: fd.get("stationId") || null,
    }, form, { reset: false, successMessage: "Produto cadastrado." });
    if (!item) return;

    const image = fd.get("image");
    if (image instanceof File && image.size) await uploadProductImage(item.id, image, { reload: false });
    form.reset();
    await load();
  }

  async function resetPassword(employee) {
    const password = window.prompt(`Nova senha para ${employee.name} (mínimo 8 caracteres)`);
    if (password === null) return;
    if (password.length < 8) { setError("A nova senha deve ter pelo menos 8 caracteres."); return; }
    await patch("employee", employee.id, { password });
  }

  const categoryMap = useMemo(() => Object.fromEntries(config.categories.map((item) => [item.id, item.name])), [config.categories]);
  const stationMap = useMemo(() => Object.fromEntries(config.stations.map((item) => [item.id, item.name])), [config.stations]);
  const canManageConfig = ["OWNER", "ADMIN"].includes(config.currentRole);

  return <section className={styles.wrapper} id="cadastros">
    <div className={styles.heading}><div><span>Configuração</span><h2>Cadastros do restaurante</h2><p>{canManageConfig ? "Mesas, cardápio, setores e acessos ficam sob controle do administrador." : "Modo de consulta. Alterações exigem perfil de proprietário ou administrador."}</p></div><button onClick={load} type="button">Atualizar</button></div>
    <nav className={styles.tabs}>{[["tables", "Mesas"], ["catalog", "Cardápio"], ["employees", "Funcionários"]].map(([id, label]) => <button className={tab === id ? styles.activeTab : ""} key={id} onClick={() => setTab(id)} type="button">{label}</button>)}</nav>
    {message && <div className={styles.success}>{message}</div>}
    {error && <div className={styles.error} role="alert">{error}</div>}

    {tab === "tables" && <div className={styles.layout}>{canManageConfig ? <form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); create("table", { number: fd.get("number"), label: fd.get("label"), seats: fd.get("seats") }, form); }}><span>Nova mesa</span><h3>Cadastrar mesa</h3><p>Ao criar a mesa, o QR Code do cliente é gerado automaticamente.</p><label>Número<input name="number" min="1" required type="number" /></label><label>Identificação opcional<input name="label" placeholder="Varanda, Salão..." /></label><label>Lugares<input name="seats" min="1" type="number" /></label><button type="submit">Criar mesa + QR Code</button></form> : <div className={styles.formCard}><span>Mesas</span><h3>Somente consulta</h3><p>O administrador define a numeração das mesas e seus QR Codes permanentes.</p></div>}
      <div className={styles.list}><div className={styles.listHeader}><strong>Mesas cadastradas</strong><span>{config.tables.length}</span></div>{config.tables.map((table) => <article className={`${styles.row} ${styles.tableRow}`} key={table.id}><TableQr table={table}/><div><strong>#{String(table.number).padStart(2, "0")} · {table.label || `Mesa ${table.number}`}</strong><small>{table.seats ? `${table.seats} lugares · ` : ""}{table.status}</small><code>/m/{table.public_code}</code></div>{canManageConfig && <div className={styles.rowActions}><button className={table.active ? styles.danger : styles.successButton} onClick={() => patch("table", table.id, { active: !table.active })} type="button">{table.active ? "Desativar" : "Ativar"}</button></div>}</article>)}</div></div>}

    {tab === "catalog" && <div className={styles.catalogGrid}>{canManageConfig && <><form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); create("category", { name: fd.get("name") }, form); }}><span>Cardápio</span><h3>Nova categoria</h3><label>Nome<input name="name" required placeholder="Pizzas, Bebidas..." /></label><button type="submit">Criar categoria</button></form>
      <form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); create("station", { code: fd.get("code"), name: fd.get("name") }, form); }}><span>Produção</span><h3>Nova estação</h3><label>Código<input name="code" required placeholder="KITCHEN" /></label><label>Nome<input name="name" required placeholder="Cozinha" /></label><button type="submit">Criar estação</button></form>
      <form className={`${styles.formCard} ${styles.productForm}`} onSubmit={createProduct}><span>Produto</span><h3>Novo item do cardápio</h3><label>Nome<input name="name" required /></label><label>Preço<input name="price" min="0" step="0.01" required type="number" /></label><label>Categoria<select name="categoryId"><option value="">Sem categoria</option>{config.categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Destino<select name="stationId"><option value="">Sem estação</option>{config.stations.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={styles.full}>Descrição<input name="description" placeholder="Descrição que aparece no cardápio" /></label><label className={styles.full}>Imagem do produto<input accept="image/jpeg,image/png,image/webp,image/avif" name="image" type="file" /></label><small className={styles.full}>JPG, PNG, WebP ou AVIF · máximo 5 MB.</small><button className={styles.full} type="submit">Cadastrar produto</button></form></>}
      {!canManageConfig && <div className={styles.formCard}><span>Cardápio</span><h3>Somente consulta</h3><p>Produtos, categorias, preços e destinos de produção são alterados pelo administrador.</p></div>}
      <div className={`${styles.list} ${styles.fullList}`}><div className={styles.listHeader}><strong>Produtos cadastrados</strong><span>{config.products.length}</span></div>{config.products.map((product) => <article className={`${styles.row} ${styles.productRow}`} key={product.id}><div className={styles.productThumb}>{product.image_url ? <img alt={product.name} src={product.image_url} /> : <span>Sem foto</span>}</div><div><strong>{product.name}</strong><small>{money.format(product.price)} · {categoryMap[product.category_id] || "Sem categoria"} · {stationMap[product.prep_station_id] || "Sem estação"}</small></div>{canManageConfig && <div className={styles.rowActions}><label className={styles.uploadButton}>{uploadingProductId === product.id ? "Enviando..." : product.image_url ? "Trocar foto" : "Adicionar foto"}<input accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadingProductId === product.id} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadProductImage(product.id, file); event.target.value = ""; }} type="file" /></label><button onClick={() => { const value = window.prompt("Novo preço", String(product.price)); if (value !== null && value !== "") patch("product", product.id, { price: Number(value) }); }} type="button">Preço</button><button className={product.active ? styles.danger : styles.successButton} onClick={() => patch("product", product.id, { active: !product.active })} type="button">{product.active ? "Desativar" : "Ativar"}</button></div>}</article>)}</div></div>}

    {tab === "employees" && <div className={styles.layout}>{canManageConfig ? <form className={styles.formCard} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); const rawUntil = fd.get("activeUntil"); create("employee", { name: fd.get("name"), email: fd.get("email"), password: fd.get("password"), loginCode: fd.get("loginCode"), role: fd.get("role"), employmentType: fd.get("employmentType"), activeUntil: rawUntil ? new Date(String(rawUntil)).toISOString() : null }, form); }}><span>Equipe</span><h3>Novo acesso</h3><label>Nome<input name="name" required /></label><label>E-mail de login<input name="email" required type="email" /></label><label>Senha inicial<input minLength="8" name="password" required type="password" /></label><label>Código curto<input name="loginCode" placeholder="carlos" /></label><label>Função<select name="role">{roles.filter(([role]) => role !== "ADMIN" || config.currentRole === "OWNER").map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label><label>Contrato<select name="employmentType"><option value="FIXED">Fixo</option><option value="TEMPORARY">Temporário</option></select></label><label>Validade do acesso<input name="activeUntil" type="datetime-local" /></label><button type="submit">Criar funcionário</button></form> : <div className={styles.formCard}><span>Equipe</span><h3>Somente consulta</h3><p>Somente proprietário ou administrador podem criar, desativar ou trocar senhas de acessos.</p></div>}
      <div className={styles.list}><div className={styles.listHeader}><strong>Equipe cadastrada</strong><span>{config.employees.length}</span></div>{config.employees.map((employee) => <article className={styles.row} key={employee.id}><div className={styles.avatar}>{employee.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div><div><strong>{employee.name}</strong><small>{employee.role} · {employee.login_email || "sem e-mail sincronizado"}</small><code>{employee.login_code || "sem código curto"}</code></div>{canManageConfig && <div className={styles.rowActions}><button onClick={() => resetPassword(employee)} type="button">Nova senha</button>{employee.role !== "OWNER" && <button className={employee.is_active ? styles.danger : styles.successButton} onClick={() => patch("employee", employee.id, { isActive: !employee.is_active })} type="button">{employee.is_active ? "Desativar" : "Ativar"}</button>}</div>}</article>)}</div></div>}

    {loading && <div className={styles.loading}>Carregando cadastros...</div>}
  </section>;
}
