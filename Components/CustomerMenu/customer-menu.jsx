"use client";

import { useMemo, useState } from "react";
import { menuCategories, menuProducts } from "@/lib/mock-data";
import styles from "./customer-menu.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function getTableLabel(tableCode) {
  if (tableCode === "demo") return "04";
  const numeric = String(tableCode).match(/\d+/)?.[0];
  return numeric?.padStart(2, "0") || String(tableCode).slice(0, 6).toUpperCase();
}

export default function CustomerMenu({ tableCode }) {
  const [customer, setCustomer] = useState(null);
  const [activeCategory, setActiveCategory] = useState(menuCategories[0].id);
  const [notes, setNotes] = useState({});
  const [cart, setCart] = useState([]);
  const [orderSent, setOrderSent] = useState(false);
  const tableLabel = getTableLabel(tableCode);
  const visibleProducts = menuProducts.filter((product) => product.category === activeCategory);
  const subtotal = useMemo(() => cart.reduce((total, item) => total + item.product.price * item.quantity, 0), [cart]);

  function startSession(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const whatsapp = String(form.get("whatsapp") || "").trim();
    if (!name || !whatsapp) return;
    setCustomer({ name, whatsapp, openedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
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

  function sendOrder() {
    if (!cart.length) return;
    setCart([]);
    setOrderSent(true);
  }

  if (!customer) {
    return <main className={styles.onboarding}><section className={styles.welcomeCard}>
      <div className={styles.tableBadge}>Mesa {tableLabel}</div><span className={styles.eyebrow}>Bem-vindo</span><h1>Seu pedido começa aqui.</h1>
      <p>Identificamos sua mesa. Informe seus dados para abrir a comanda e acessar o cardápio.</p>
      <form className={styles.form} onSubmit={startSession}>
        <label>Nome<input name="name" placeholder="Como podemos chamar você?" required /></label>
        <label>WhatsApp<input name="whatsapp" inputMode="tel" placeholder="(51) 99999-9999" required /></label>
        <button type="submit">Ver cardápio</button>
      </form><small>O horário de chegada é registrado quando a comanda é aberta.</small>
    </section></main>;
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Mesa {tableLabel}</span><h1>Olá, {customer.name.split(" ")[0]}.</h1><p>Comanda aberta às {customer.openedAt}</p></div><div className={styles.status}><span />Comanda aberta</div></header>
    {orderSent && <div className={styles.success}><strong>Pedido recebido.</strong><span>Você pode continuar pedindo normalmente.</span></div>}
    <nav className={styles.categories} aria-label="Categorias do cardápio">{menuCategories.map((category) => <button className={activeCategory === category.id ? styles.active : ""} key={category.id} onClick={() => setActiveCategory(category.id)} type="button">{category.label}</button>)}</nav>
    <section className={styles.products}>{visibleProducts.map((product) => <article className={styles.productCard} key={product.id}>
      <div className={styles.productTop}><div><span className={styles.station}>{product.station === "BAR" ? "Copa" : "Cozinha"}</span><h2>{product.name}</h2><p>{product.description}</p></div><strong>{money.format(product.price)}</strong></div>
      <div className={styles.productAction}><input aria-label={`Observação para ${product.name}`} onChange={(event) => setNotes((current) => ({ ...current, [product.id]: event.target.value }))} placeholder="Observação, se precisar" value={notes[product.id] || ""} /><button onClick={() => addProduct(product)} type="button">Adicionar</button></div>
    </article>)}</section>
    <aside className={styles.cart}><div className={styles.cartHeader}><div><span>Seu pedido</span><strong>{cart.length ? `${cart.length} item(ns)` : "Carrinho vazio"}</strong></div><strong>{money.format(subtotal)}</strong></div>
      {cart.length > 0 && <div className={styles.cartItems}>{cart.map((item, index) => <div className={styles.cartItem} key={`${item.product.id}-${index}`}><div><strong>{item.product.name}</strong>{item.observation && <small>{item.observation}</small>}</div><div className={styles.quantity}><button onClick={() => changeQuantity(index, -1)} type="button">−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(index, 1)} type="button">+</button></div></div>)}</div>}
      <div className={styles.cartFooter}><div><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div><button disabled={!cart.length} onClick={sendOrder} type="button">Fazer pedido</button></div>
    </aside>
  </main>;
}
