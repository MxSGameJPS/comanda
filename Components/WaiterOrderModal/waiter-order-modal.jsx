"use client";

import { useEffect, useMemo, useState } from "react";
import VoidItemModal from "@/Components/VoidItemModal/void-item-modal";
import styles from "./waiter-order-modal.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function statusLabel(status) {
  if (status === "AVAILABLE") return "Livre";
  if (status === "PAYMENT_PENDING") return "Aguardando pagamento";
  if (status === "OPEN") return "Em atendimento";
  return status || "Sem comanda";
}

export default function WaiterOrderModal({ table, categories, products, onClose, onSend, onVoid }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [voidingItem, setVoidingItem] = useState(null);
  const firstCategoryId = categories[0]?.id || null;

  useEffect(() => {
    if (!firstCategoryId) return;
    setActiveCategory((current) => current && categories.some((category) => category.id === current) ? current : firstCategoryId);
  }, [categories, firstCategoryId]);

  useEffect(() => {
    setCart([]);
    setNotes({});
    setSending(false);
    setError("");
    setVoidingItem(null);
    if (firstCategoryId) setActiveCategory(firstCategoryId);
  }, [firstCategoryId, table?.sessionId]);

  useEffect(() => {
    if (!table) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !sending) onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, sending, table]);

  const visibleProducts = products.filter((product) => product.category_id === activeCategory);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0), [cart]);

  if (!table) return null;

  function addProduct(product) {
    const observation = String(notes[product.id] || "").trim();
    setCart((current) => {
      const index = current.findIndex((item) => item.product.id === product.id && item.observation === observation);
      if (index < 0) return [...current, { product, quantity: 1, observation }];
      return current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity + 1 } : item);
    });
    setNotes((current) => ({ ...current, [product.id]: "" }));
  }

  function changeQuantity(index, delta) {
    setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  }

  async function sendOrder() {
    if (!cart.length || sending || table.status !== "OPEN") return;
    setSending(true);
    setError("");
    try {
      await onSend(table.sessionId, cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, observation: item.observation })));
      setCart([]);
    } catch (sendError) {
      setError(sendError.message || "Não foi possível lançar o pedido.");
    } finally {
      setSending(false);
    }
  }

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !sending && onClose?.()}>
    <section aria-modal="true" className={styles.modal} role="dialog">
      <header className={styles.header}><div><span>Mesa {String(table.number).padStart(2, "0")}</span>{table.customer && <h2>{table.customer}</h2>}{table.whatsapp && <p>{table.whatsapp}</p>}</div><button aria-label="Fechar" disabled={sending} onClick={() => onClose?.()} type="button">×</button></header>
      <div className={styles.summary}><div><span>Comanda</span><strong>{money.format(Number(table.total ?? table.subtotal ?? 0))}</strong></div><div><span>Status</span><strong>{statusLabel(table.status)}</strong></div></div>

      <section className={styles.current}><div className={styles.sectionTitle}><h3>Itens da comanda</h3><span>{table.items?.length || 0} lançamento(s)</span></div>
        <div className={styles.itemList}>{table.items?.length ? table.items.map((item) => <article className={styles.currentItem} key={item.id}><div><strong>{item.quantity}× {item.product_name_snapshot}</strong><small>{item.observation || `${money.format(item.unit_price)} cada`}</small></div><div><span>{money.format(item.total_price)}</span><button onClick={() => setVoidingItem(item)} type="button">Cancelar</button></div></article>) : <p className={styles.empty}>Nenhum item lançado ainda.</p>}</div>
      </section>

      <section className={styles.catalog}><div className={styles.sectionTitle}><h3>Adicionar produtos</h3><span>{table.status === "OPEN" ? "Novo pedido" : "Comanda bloqueada"}</span></div>
        <nav className={styles.categories}>{categories.map((category) => <button className={activeCategory === category.id ? styles.active : ""} key={category.id} onClick={() => setActiveCategory(category.id)} type="button">{category.name}</button>)}</nav>
        <div className={styles.products}>{visibleProducts.map((product) => <article className={styles.product} key={product.id}><div><span>{product.station === "BAR" ? "Copa" : product.station === "KITCHEN" ? "Cozinha" : "Pedido"}</span><strong>{product.name}</strong><small>{product.description}</small></div><b>{money.format(product.price)}</b><div className={styles.productAction}><input disabled={table.status !== "OPEN"} onChange={(event) => setNotes((current) => ({ ...current, [product.id]: event.target.value }))} placeholder="Observação" value={notes[product.id] || ""}/><button disabled={table.status !== "OPEN"} onClick={() => addProduct(product)} type="button">Adicionar</button></div></article>)}</div>
      </section>

      {cart.length > 0 && <section className={styles.cart}><div className={styles.sectionTitle}><h3>Novo lançamento</h3><strong>{money.format(cartTotal)}</strong></div>{cart.map((item, index) => <div className={styles.cartItem} key={`${item.product.id}-${index}`}><div><strong>{item.product.name}</strong><small>{item.observation}</small></div><div className={styles.quantity}><button onClick={() => changeQuantity(index, -1)} type="button">−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(index, 1)} type="button">+</button></div></div>)}<button className={styles.send} disabled={sending} onClick={sendOrder} type="button">{sending ? "Lançando..." : `Lançar pedido · ${money.format(cartTotal)}`}</button></section>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
    <VoidItemModal item={voidingItem} onClose={() => setVoidingItem(null)} onConfirm={onVoid}/>
  </div>;
}
