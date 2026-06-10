import type { PaymentMethod, DeliveryAddress, Order } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface WhatsAppResult {
  success: boolean;
  messageId: string | null;
}

const STATUS_MESSAGES: Record<string, string> = {
  PAID: 'seu pagamento foi confirmado',
  PREPARING: 'seu pedido está sendo preparado',
  DELIVERING: 'seu pedido saiu para entrega',
  COMPLETED: 'seu pedido foi entregue com sucesso',
  CANCELLED: 'seu pedido foi cancelado',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  meal_voucher: 'Vale-Refeição',
};

function formatAddress(addr: DeliveryAddress): string {
  const parts = [addr.street, addr.number].filter(Boolean);
  if (addr.complement) parts.push(`(${addr.complement})`);
  parts.push(addr.neighborhood, addr.city);
  if (addr.state) parts.push(addr.state);
  return parts.filter(Boolean).join(', ');
}

function buildMessage(order: Order, restaurantName: string, newStatus: string, portalUrl?: string): string {
  const statusMsg = STATUS_MESSAGES[newStatus] || `seu pedido foi atualizado para: ${newStatus}`;
  const items = order.items.map(i => `${i.emoji} ${i.name} x${i.quantity}`).join('\n');
  const delivery = order.deliveryType === 'delivery' && order.deliveryAddress
    ? `\nEntrega: ${formatAddress(order.deliveryAddress)}`
    : `\nRetirada no local`;

  let ctaLine = '';
  if (newStatus === 'COMPLETED' && portalUrl) {
    ctaLine = `\n\n⭐ Gostou? Avalie seu pedido e nos ajude a melhorar:\n${portalUrl}`;
  } else if (portalUrl) {
    ctaLine = `\n\nAcompanhe seu pedido: ${portalUrl}`;
  }

  return `${restaurantName} — Atualização do Pedido\n\nOlá ${order.customerName}, ${statusMsg}!\n\nItens:\n${items}\n\nTotal: R$ ${order.total.toFixed(2).replace('.', ',')}\nPagamento: ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}${delivery}${ctaLine}\n\nObrigado pela preferência!`;
}

export async function sendWhatsAppNotification(
  apiToken: string,
  phoneNumberId: string,
  order: Order,
  restaurantName: string,
  newStatus: string,
  portalUrl?: string
): Promise<WhatsAppResult> {
  const message = buildMessage(order, restaurantName, newStatus, portalUrl);
  const phone = order.customerPhone.replace(/\D/g, '');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      apiToken,
      phoneNumberId,
      to: phone,
      message,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Falha ao enviar WhatsApp');
  }

  return res.json();
}
