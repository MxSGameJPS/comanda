const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const paymentLabels = { PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito", OTHER: "Outro" };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberLabel(value) {
  return String(value || 0).padStart(6, "0");
}

function row(label, value, strong = false) {
  return `<div class="row${strong ? " strong" : ""}"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}

export function printSalesReceipt(receipt, { mode = "customer" } = {}) {
  if (!receipt || typeof window === "undefined") return false;

  const admin = mode === "admin";
  const items = Array.isArray(receipt.items_snapshot) ? receipt.items_snapshot : [];
  const payments = Array.isArray(receipt.payment_snapshot) ? receipt.payment_snapshot : [];
  const staff = Array.isArray(receipt.staff_snapshot) ? receipt.staff_snapshot : [];
  const voids = Array.isArray(receipt.voids_snapshot) ? receipt.voids_snapshot : [];
  const printWindow = window.open("", "_blank", "width=420,height=760");
  if (!printWindow) return false;
  printWindow.opener = null;

  const itemsHtml = items.length
    ? items.map((item) => `<div class="item"><div><b>${escapeHtml(item.quantity)}x ${escapeHtml(item.product_name)}</b>${item.observation ? `<small>${escapeHtml(item.observation)}</small>` : ""}</div><b>${escapeHtml(money.format(Number(item.total_price || 0)))}</b></div>`).join("")
    : '<p class="muted">Nenhum item lançado.</p>';

  const paymentsHtml = payments.length
    ? payments.map((payment) => row(paymentLabels[payment.method] || payment.method, money.format(Number(payment.amount || 0)))).join("")
    : row("Sem pagamento registrado", money.format(0));

  const staffHtml = staff.length
    ? `<section><h3>Atendimento</h3>${staff.map((member) => `<div class="row"><span>${escapeHtml(member.name || "Equipe")}</span><small>${escapeHtml(member.role || "Equipe")}</small></div>`).join("")}</section>`
    : "";

  const voidsHtml = admin && voids.length
    ? `<section><h3>Cancelamentos</h3>${voids.map((item) => `<div class="item"><div><b>${escapeHtml(item.quantity)}x ${escapeHtml(item.product_name)}</b><small>${escapeHtml(item.reason || "Sem motivo informado")}</small></div><div class="right"><b>${escapeHtml(money.format(Number(item.total_price || 0)))}</b><small>${escapeHtml(item.employee_name || "Funcionário")}</small></div></div>`).join("")}</section>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Comprovante #${numberLabel(receipt.receipt_number)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: 74mm; margin: 0 auto; font-family: "Courier New", Courier, monospace; font-size: 11px; line-height: 1.35; }
  .receipt { width: 100%; padding: 2mm 0; }
  header { text-align: center; padding-bottom: 3mm; border-bottom: 1px dashed #000; }
  header h1 { margin: 0 0 1mm; font-size: 15px; }
  header p { margin: 0; font-size: 11px; }
  header strong { display: block; margin-top: 1mm; font-size: 10px; }
  section, .meta, .totals, footer { padding: 3mm 0; border-bottom: 1px dashed #000; }
  h3 { margin: 0 0 2mm; font-size: 11px; text-transform: uppercase; }
  .row, .item { display: flex; align-items: flex-start; justify-content: space-between; gap: 3mm; margin-top: 1.2mm; }
  .row:first-child, .item:first-child { margin-top: 0; }
  .row > span, .item > div:first-child { min-width: 0; flex: 1; }
  .row > b, .item > b, .right { flex: 0 0 auto; text-align: right; }
  .item > div { display: grid; gap: .6mm; }
  small, .muted { display: block; font-size: 9px; }
  .strong { margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #000; font-size: 13px; }
  footer { border-bottom: 0; text-align: center; }
  footer b { display: block; margin-top: 2mm; font-size: 9px; }
  .screen-only { margin: 14px 0 24px; text-align: center; }
  .screen-only button { padding: 10px 18px; border: 0; border-radius: 8px; background: #111; color: #fff; font-weight: 700; cursor: pointer; }
  @media print { .screen-only { display: none !important; } body { width: 74mm; } }
</style>
</head>
<body>
<div class="receipt">
  <header>
    <h1>COMPROVANTE INTERNO</h1>
    <p>Nº ${numberLabel(receipt.receipt_number)}</p>
    <strong>SEM VALOR FISCAL</strong>
  </header>

  <div class="meta">
    ${row("Mesa", `${String(receipt.table_number || "").padStart(2, "0")}${receipt.table_label ? ` · ${receipt.table_label}` : ""}`)}
    ${row("Cliente", receipt.customer_name || "Consumidor")}
    ${admin && receipt.customer_whatsapp ? row("WhatsApp", receipt.customer_whatsapp) : ""}
    ${row("Entrada", receipt.opened_at ? dateTime.format(new Date(receipt.opened_at)) : "—")}
    ${row("Fechamento", receipt.closed_at ? dateTime.format(new Date(receipt.closed_at)) : "—")}
  </div>

  ${staffHtml}

  <section>
    <h3>Itens</h3>
    ${itemsHtml}
  </section>

  <div class="totals">
    ${row("Subtotal", money.format(Number(receipt.subtotal || 0)))}
    ${Number(receipt.discount || 0) > 0 ? row("Desconto", `- ${money.format(Number(receipt.discount || 0))}`) : ""}
    ${Number(receipt.service_fee || 0) > 0 ? row("Taxa de serviço", money.format(Number(receipt.service_fee || 0))) : ""}
    ${row("TOTAL", money.format(Number(receipt.total || 0)), true)}
  </div>

  <section>
    <h3>Pagamento</h3>
    ${paymentsHtml}
  </section>

  ${voidsHtml}

  <footer>
    <span>Fechado por: ${escapeHtml(receipt.closed_by_name || "Sistema")}</span>
    <b>DOCUMENTO INTERNO · SEM VALOR FISCAL</b>
  </footer>
</div>
<div class="screen-only"><button type="button" onclick="window.print()">Imprimir cupom</button></div>
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.focus(); window.print(); }, 150);
  });
</script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
