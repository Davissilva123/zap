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

// ── ESC/POS via Web Serial API (Chrome/Edge com impressora USB/serial) ──────
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

function bytes(...b: number[]): Uint8Array { return new Uint8Array(b); }
function text(s: string): Uint8Array { return new TextEncoder().encode(s); }

const CMD = {
  init:       bytes(ESC, 0x40),
  cut:        bytes(GS, 0x56, 0x41, 0x00),
  boldOn:     bytes(ESC, 0x45, 0x01),
  boldOff:    bytes(ESC, 0x45, 0x00),
  center:     bytes(ESC, 0x61, 0x01),
  left:       bytes(ESC, 0x61, 0x00),
  right:      bytes(ESC, 0x61, 0x02),
  dblHeight:  bytes(GS, 0x21, 0x01),
  dblSize:    bytes(GS, 0x21, 0x11),
  normalSize: bytes(GS, 0x21, 0x00),
  lf:         bytes(LF),
};

function line80(left: string, right: string, width = 42): string {
  const gap = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

export function isSerialSupported(): boolean {
  return 'serial' in navigator;
}

export async function printReceiptSerial(order: Order, settings: RestaurantSettings): Promise<void> {
  if (!isSerialSupported()) throw new Error('Web Serial não suportado. Use Chrome/Edge.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serial = (navigator as any).serial;
  const port = await serial.requestPort();
  await port.open({ baudRate: 9600 });
  const writer = port.writable.getWriter();

  const write = async (...chunks: Uint8Array[]) => {
    for (const c of chunks) await writer.write(c);
  };

  const sep = () => write(text('─'.repeat(42) + '\n'));
  const pay = PAYMENT_METHOD_LABELS[order.paymentMethod];
  const orderId = order.id.slice(-8).toUpperCase();

  try {
    await write(CMD.init);
    await write(CMD.center, CMD.boldOn, CMD.dblSize, text(settings.name + '\n'), CMD.normalSize, CMD.boldOff);
    if (settings.address) await write(CMD.center, text(settings.address + '\n'));
    if (settings.phone)   await write(CMD.center, text(settings.phone + '\n'));
    await write(CMD.lf);
    await sep();
    await write(CMD.center, CMD.boldOn, CMD.dblHeight, text(`PEDIDO #${orderId}\n`), CMD.normalSize, CMD.boldOff);
    await write(CMD.center, text(new Date(order.createdAt).toLocaleString('pt-BR') + '\n'));
    await sep();

    await write(CMD.left);
    await write(text(`Cliente: ${order.customerName}\n`));
    await write(text(`Fone: ${order.customerPhone}\n`));
    await write(text(`Entrega: ${order.deliveryType === 'delivery' ? 'DELIVERY' : order.deliveryType === 'table' ? `Mesa ${order.tableName ?? ''}` : 'RETIRADA'}\n`));
    if (order.deliveryType === 'delivery' && order.deliveryAddress) {
      const a = order.deliveryAddress;
      await write(text(`End: ${[a.street, a.number, a.neighborhood].filter(Boolean).join(', ')}\n`));
    }
    await sep();

    await write(CMD.boldOn, text('ITENS\n'), CMD.boldOff);
    for (const item of order.items) {
      const left  = `${item.quantity}x ${item.name}`;
      const right = `R$${(item.price * item.quantity).toFixed(2)}`;
      await write(text(line80(left, right) + '\n'));
      if (item.selectedOptions?.length) {
        for (const opt of item.selectedOptions) {
          await write(text(`  + ${opt.optionName}\n`));
        }
      }
    }
    await sep();

    if (order.discount > 0) await write(text(line80('Desconto:', `-R$${order.discount.toFixed(2)}`) + '\n'));
    await write(CMD.boldOn, CMD.dblHeight, text(line80('TOTAL:', `R$${order.total.toFixed(2)}`)), CMD.normalSize, CMD.boldOff, CMD.lf);
    await sep();
    await write(text(`Pagamento: ${pay?.label ?? order.paymentMethod}\n`));
    if (order.notes) await write(text(`Obs: ${order.notes}\n`));
    await sep();
    await write(CMD.center, text('\nObrigado pela preferencia!\nVolte sempre!\n\n'));
    await write(CMD.cut);
  } finally {
    writer.releaseLock();
    await port.close();
  }
}
