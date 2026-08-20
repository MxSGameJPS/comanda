"use client";

import { useEffect, useMemo, useState } from "react";
import { menuCategories as demoCategories, menuProducts as demoProducts } from "@/lib/mock-data";
import styles from "./customer-menu.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function tableLabelFromCode(tableCode) {
  const numeric = String(tableCode).match(/\d+/)?.[0];
  return numeric?.padStart(2, "0") || "--";
}

export default function CustomerMenu({ tableCode }) {
  const demo = tableCode === "demo";
  const [table, setTable] = useState(demo ? { number: 4, status: "AVAILABLE" } : null);
  const [categories, setCategories] = useState(demo ? demoCategories.map((item) => ({ id: item.id, name: item.label })) : []);
  const [products, setProducts] = useState(demo ? demoProducts.map((item) => ({ ...item, category_id: item.category })) : []);
  const [customer, setCustomer] = useState(null);
  const [session, setSession] = useState(null);
  const [activeCategory, setActiveCategory] = useState(demoCategories[0]?.id || null);
  const [notes, setNotes] = useState({});
  const [cart, setCart] = useState([]);
  const [orderSent, setOrderSent] = useState(false);
  const [loading, setLoading] = useState(!demo);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);

  const tableLabel = table?.number ? String(table.number).padStart(2, "0") : tableLabelFromCode(tableCode);
  const visibleProducts = products.filter((product) => product.category_id === activeCategory);
  const subtotal = useMemo(() => cart.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0), [cart]);
  const scopedSessionUrl = `/api/public/session?tableCode=${encodeURIComponent(tableCode)}`;

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    async function bootstrap() {
      try {
        const [tableResponse, sessionResponse] = await Promise.all([
          fetch(`/api/public/tables/${encodeURIComponent(tableCode)}`, { cache: "no-store" }),
          fetch(scopedSessionUrl, { cache: "no-store" }),
        ]);
        const tableBody = await tableResponse.json();
        const sessionBody = await sessionResponse.json();
        if (!tableResponse.ok) throw new Error(tableBody.error || "QR Code inválido.");
        if (cancelled) return;
        setTable(tableBody.table);
        setCategories(tableBody.categories);
        setProducts(tableBody.products);
        setActiveCategory(tableBody.categories[0]?.id || null);
        if (sessionBody.session) {
          setSession(sessionBody.session);
          setCustomer({ name: sessionBody.session.customer_name, openedAt: sessionBody.session.opened_at });
          if (["CLOSED", "CANCELLED"].includes(sessionBody.session.status)) setClosed(true);
        }
      } catch (bootstrapError) {
        if (!cancelled) setError(bootstrapError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, [demo, scopedSessionUrl, tableCode]);

  useEffect(() => {
    if (demo || !session || closed) return;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(scopedSessionUrl, { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json();
        if (!body.session) return;
        setSession(body.session);
        if (["CLOSED", "CANCELLED"].includes(body.session.status)) {
          setClosed(true);
          setCart([]);
          await fetch("/api/public/session", { method: "DELETE" });
        }
      } catch {}
    }, 2500);
    return () => window.clearInterval(interval);
  }, [closed, demo, scopedSessionUrl, session]);

  async function startSession(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const whatsapp = String(form.get("whatsapp") || "").trim();
    if (!name || !whatsapp) return;

    if (demo) {
      const openedAt = new Date().toISOString();
      setCustomer({ name, whatsapp, openedAt });
      setSession({ status: "OPEN", opened_at: openedAt, subtotal: 0, total: 0 });
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/public/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCode, name, whatsapp }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível abrir sua comanda.");
      setSession(body.session);
      setCustomer({ name, whatsapp, openedAt: body.session.opened_at });
    } catch (sessionError) {
      setError(sessionError.message);
    } finally {
      setSending(false);
    }
  }

  function addProduct(product) {
    const observation = String(notes[product.id] || "").trim();
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id && item.observation === observation);
      if (existing) return current.map((item) => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { product, quantity: 1, observation }];
    });
    setNotes((current) => ({ ...current, [product.id]: "" }));
    setOrderSent(false);
  }

  function changeQuantity(index, delta) {
    setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  }

  async function sendOrder() {
    if (!cart.length || sending) return;
    setSending(true);
    setError("");
    try {
      if (!demo) {
        const response = await fetch("/api/public/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, observation: item.observation })) }),
        });
        const body = await response.json();
        if (!response.ok) {
          if (response.status === 409) setClosed(true);
          throw new Error(body.error || "Não foi possível enviar o pedido.");
        }
        setSession((current) => current ? { ...current, subtotal: body.order?.subtotal, total: body.order?.total } : current);
      }
      setCart([]);
      setOrderSent(true);
    } catch (orderError) {
      setError(orderError.message);
    } finally {
      setSending(false);
    }
  }

  if (closed) {
    return <main className={styles.onboarding}><section className={`${styles.welcomeCard} ${styles.closedCard}`}><div className={styles.closedIcon}>✓</div><span className={styles.eyebrow}>Mesa {tableLabel}</span><h1>Conta encerrada.</h1><p>Obrigado pela visita. Esta comanda foi desconectada do seu aparelho e não aceita novos pedidos.</p></section></main>;
  }

  if (!customer) {
    return <main className={styles.onboarding}><section className={styles.welcomeCard}>
      <div className={styles.tableBadge}>Mesa {tableLabel}</div><span className={styles.eyebrow}>Bem-vindo</span><h1>{loading ? "Carregando sua mesa..." : "Seu pedido começa aqui."}</h1>
      <p>{loading ? "Estamos validando o QR Code e preparando o cardápio." : "Identificamos sua mesa. Informe seus dados para abrir a comanda e acessar o cardápio."}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && table && <form className={styles.form} onSubmit={startSession}>
        <label>Nome<input name="name" placeholder="Como podemos chamar você?" required /></label>
        <label>WhatsApp<input name="whatsapp" inputMode="tel" placeholder="(51) 99999-9999" required /></label>
        <button disabled={sending} type="submit">{sending ? "Abrindo comanda..." : "Ver cardápio"}</button>
      </form>}
      <small>O horário de chegada é registrado quando a comanda é aberta.</small>
    </section></main>;
  }

  const openedTime = new Date(customer.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Mesa {tableLabel}</span><h1>Olá, {customer.name.split(" ")[0]}.</h1><p>Comanda aberta às {openedTime}</p></div><div className={styles.status}><span />Comanda aberta</div></header>
    {orderSent && <div className={styles.success}><strong>Pedido recebido.</strong><span>Você pode continuar pedindo normalmente.</span></div>}
    {error && <div className={styles.errorBanner} role="alert">{error}</div>}
    <nav className={styles.categories} aria-label="Categorias do cardápio">{categories.map((category) => <button className={activeCategory === category.id ? styles.active : ""} key={category.id} onClick={() => setActiveCategory(category.id)} type="button">{category.name || category.label}</button>)}</nav>
    <section className={styles.products}>{visibleProducts.map((product) => <article className={styles.productCard} key={product.id}>
      <div className={styles.productTop}><div><span className={styles.station}>{product.station === "BAR" ? "Copa" : product.station === "KITCHEN" ? "Cozinha" : "Pedido"}</span><h2>{product.name}</h2><p>{product.description}</p></div><strong>{money.format(Number(product.price))}</strong></div>
      <div className={styles.productAction}><input aria-label={`Observação para ${product.name}`} onChange={(event) => setNotes((current) => ({ ...current, [product.id]: event.target.value }))} placeholder="Observação, se precisar" value={notes[product.id] || ""} /><button onClick={() => addProduct(product)} type="button">Adicionar</button></div>
    </article>)}</section>
    <aside className={styles.cart}><div className={styles.cartHeader}><div><span>Seu pedido</span><strong>{cart.length ? `${cart.reduce((sum, item) => sum + item.quantity, 0)} item(ns)` : "Carrinho vazio"}</strong></div><strong>{money.format(subtotal)}</strong></div>
      {cart.length > 0 && <div className={styles.cartItems}>{cart.map((item, index) => <div className={styles.cartItem} key={`${item.product.id}-${index}`}><div><strong>{item.product.name}</strong>{item.observation && <small>{item.observation}</small>}</div><div className={styles.quantity}><button onClick={() => changeQuantity(index, -1)} type="button">−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(index, 1)} type="button">+</button></div></div>)}</div>}
      <div className={styles.cartFooter}><div><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div><button disabled={!cart.length || sending} onClick={sendOrder} type="button">{sending ? "Enviando..." : "Fazer pedido"}</button></div>
    </aside>
  </main>;
}
