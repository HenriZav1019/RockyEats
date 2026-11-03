import { MODE_LABEL, PAYMENT_LABEL, deliveryAddressLines } from './staff.js'

// Prints an order on a small thermal printer (58 or 80 mm) or any printer.
// Opens a narrow ticket in a new window and calls print(); the phone or PC
// print dialog picks the printer (on Android, a Bluetooth printer works through
// a print service app such as RawBT or the printer maker's app).
//
// kind: 'full'    -> owner's ticket with customer, payment and prices
//       'kitchen' -> big text, items and notes only (optionally one station)

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const money = (n) => `$${Number(n || 0).toFixed(2)}`

export function printTicket(order, { restaurantName = '', kind = 'full', station = null } = {}) {
  const items = (order.order_items || []).filter((i) => !station || i.station_snapshot === station)
  const time = new Date(order.created_at).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const kitchen = kind === 'kitchen'

  const itemRows = items
    .map(
      (i) => `
      <div class="item">
        <div class="row"><span><b>${i.quantity}×</b> ${esc(i.name_snapshot)}</span>${kitchen ? '' : `<span>${money(i.line_total ?? i.price_snapshot * i.quantity)}</span>`}</div>
        ${i.notes ? `<div class="note">» ${esc(i.notes)}</div>` : ''}
      </div>`,
    )
    .join('')

  const address = order.mode === 'delivery' ? deliveryAddressLines(order) : []
  const subtotal = items.reduce((s, i) => s + Number(i.line_total ?? i.price_snapshot * i.quantity), 0)
  const fee = order.mode === 'delivery' ? order.delivery_fee : null

  const body = kitchen
    ? `
      <div class="big">${esc(order.order_number)}</div>
      <div class="center">${esc(MODE_LABEL[order.mode] || '')} · ${esc(time)}</div>
      ${station ? `<div class="center"><b>${station === 'bar' ? 'BAR' : 'COCINA'}</b></div>` : ''}
      <div class="center">${esc(order.customer_name)}</div>
      <hr />
      <div class="kitchen">${itemRows}</div>`
    : `
      <div class="center"><b>${esc(restaurantName)}</b></div>
      <div class="big">${esc(order.order_number)}</div>
      <div class="center">${esc(time)}</div>
      <hr />
      <div><b>${esc(order.customer_name)}</b></div>
      <div>${esc(order.customer_phone)}</div>
      <div>${esc(MODE_LABEL[order.mode] || '')} · ${esc(PAYMENT_LABEL[order.payment_method] || '')}</div>
      ${address.map((l) => `<div>${esc(l)}</div>`).join('')}
      <hr />
      ${itemRows}
      <hr />
      ${
        order.mode === 'delivery'
          ? `<div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
             <div class="row"><span>Envío</span><span>${fee === null || fee === undefined ? 'Repartidor' : money(fee)}</span></div>`
          : ''
      }
      <div class="row total"><span>TOTAL</span><span>${money(order.total)}</span></div>
      <div class="center small">${order.payment_confirmed ? 'PAGADO' : 'Pago pendiente'}</div>
      <div class="center small">rockyeats.app</div>`

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pedido ${esc(order.order_number)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; width: 72mm; max-width: 100%; font: 13px/1.35 ui-monospace, Menlo, Consolas, monospace; color: #000; background: #fff; padding: 4mm 0; }
  .center { text-align: center; }
  .big { text-align: center; font-size: 34px; font-weight: 800; letter-spacing: 1px; margin: 2px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .item { margin: 4px 0; }
  .note { margin-left: 10px; font-weight: 700; }
  .kitchen { font-size: 17px; }
  .kitchen .note { font-size: 15px; }
  .total { font-size: 17px; font-weight: 800; margin-top: 4px; }
  .small { font-size: 11px; margin-top: 4px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  @media screen { body { padding: 16px 0; } }
</style></head>
<body>${body}
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 150);
  });
  window.addEventListener('afterprint', function () { window.close(); });
</script>
</body></html>`

  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) return false // popup blocked
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}
