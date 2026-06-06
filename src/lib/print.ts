import type { Order, RestaurantSettings } from './types';
import { PAYMENT_METHOD_LABELS } from './xgate';

function fmt(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}` }
function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function printOrder(order: Order, settings: RestaurantSettings) {
  const pay = PAYMENT_METHOD_LABELS[order.paymentMethod];
  const orderId = order.id.slice(-8).toUpperCase();

  let addrHtml = '';
  if (order.deliveryType === 'delivery' && order.deliveryAddress) {
    const a = order.deliveryAddress;
    const line = [a.street, a.number, a.complement ? `(${a.complement})` : '', a.neighborhood, a.city, a.state].filter(Boolean).join(', ');
    addrHtml = `<div class="row"><span>Endereço:</span><span style="text-align:right;max-width:160px">${line}</span></div>`;
  }

  const itemsHtml = order.items.map(item => `
    <div class="row" style="margin:3px 0">
      <span>${item.quantity}x ${item.name}</span>
      <span>${fmt(item.price * item.quantity)}</span>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Pedido #${orderId}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Courier New',Courier,monospace; font-size:11px; width:302px; padding:6px 8px; color:#000; background:#fff }
  .center { text-align:center }
  .bold { font-weight:bold }
  .lg { font-size:14px }
  .xl { font-size:18px }
  .sep { border-top:1px dashed #000; margin:5px 0 }
  .row { display:flex; justify-content:space-between; gap:4px; margin:2px 0 }
  .total-row { display:flex; justify-content:space-between; font-size:15px; font-weight:bold; margin:3px 0 }
  @media print { @page { size:80mm auto; margin:0 } body { width:80mm } }
</style>
</head>
<body>
  <div class="center bold xl" style="letter-spacing:1px">${settings.name}</div>
  ${settings.address ? `<div class="center" style="font-size:10px">${settings.address}</div>` : ''}
  ${settings.phone ? `<div class="center" style="font-size:10px">${settings.phone}</div>` : ''}

  <div class="sep"></div>

  <div class="center bold lg">PEDIDO #${orderId}</div>
  <div class="center" style="font-size:10px">${fmtDate(order.createdAt)}</div>

  <div class="sep"></div>

  <div class="row"><span class="bold">Cliente:</span><span>${order.customerName}</span></div>
  <div class="row"><span class="bold">Telefone:</span><span>${order.customerPhone}</span></div>
  <div class="row"><span class="bold">Entrega:</span><span>${order.deliveryType === 'delivery' ? '🛵 DELIVERY' : '🏠 RETIRADA'}</span></div>
  ${addrHtml}

  <div class="sep"></div>

  <div class="bold" style="margin-bottom:4px">ITENS DO PEDIDO</div>
  ${itemsHtml}

  <div class="sep"></div>

  <div class="total-row">
    <span>TOTAL</span>
    <span>${fmt(order.total)}</span>
  </div>

  <div class="sep"></div>

  <div class="row"><span class="bold">Pagamento:</span><span>${pay?.label ?? order.paymentMethod}</span></div>
  ${order.pixTxId ? `<div style="font-size:9px;margin-top:2px">TX: ${order.pixTxId}</div>` : ''}

  <div class="sep"></div>

  <div class="center" style="margin-top:6px;font-size:10px">Obrigado pela preferência!</div>
  <div class="center" style="font-size:9px;margin-top:2px;color:#555">Powered by ZapMenu</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=330,height=620');
  if (!win) { alert('Permita pop-ups neste site para imprimir o cupom.'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); win.onafterprint = () => win.close(); };
}
