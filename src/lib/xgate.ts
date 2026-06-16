import type { Order, OrderItem, PaymentMethod, DeliveryAddress } from './types';
import { db } from './db';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface PixChargeResult {
  id: string;
  txId: string;
  status: string;
  qrCode: string;
  qrCodeImage: string | null;
  pixCopyPaste: string;
  expiresAt: string | null;
  amount: number;
}

export async function createPixCharge(
  xgateEmail: string,
  xgatePassword: string,
  amount: number,
  txId: string,
  customerName?: string,
  customerDocument?: string
): Promise<PixChargeResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-pix-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email: xgateEmail, password: xgatePassword, amount, txId, customerName, customerDocument }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Falha ao criar cobrança PIX');
  }

  return res.json();
}

export async function checkPixPayment(
  xgateEmail: string,
  xgatePassword: string,
  txId: string
): Promise<{ txId: string; status: string; paidAt: string | null; amount: number | null }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/check-pix-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email: xgateEmail, password: xgatePassword, txId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Falha ao verificar pagamento');
  }

  return res.json();
}

export async function createOrder(
  userId: string,
  items: OrderItem[],
  total: number,
  customerName: string,
  customerPhone: string,
  paymentMethod: PaymentMethod,
  deliveryType: 'pickup' | 'delivery' | 'table',
  deliveryAddress: DeliveryAddress | null,
  pixResult: PixChargeResult | null,
  customerUserId?: string,
  couponCode?: string,
  discount?: number,
  tableName?: string,
  scheduledFor?: string | null,
  notes?: string
): Promise<Order> {
  return db.addOrder({
    userId,
    customerUserId,
    items,
    total,
    discount: discount ?? 0,
    couponCode,
    status: paymentMethod === 'cash' ? 'PAID' : 'PENDING',
    customerName,
    customerPhone,
    paymentMethod,
    deliveryType,
    deliveryAddress,
    tableName,
    notes,
    pixTxId: pixResult?.txId || '',
    pixQrCode: pixResult?.qrCodeImage || pixResult?.qrCode || '',
    pixCopyPaste: pixResult?.pixCopyPaste || '',
    paidAt: paymentMethod === 'cash' ? new Date().toISOString() : null,
    scheduledFor: scheduledFor ?? null,
  });
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { label: string; emoji: string }> = {
  pix: { label: 'PIX', emoji: '📱' },
  credit_card: { label: 'Cartão de Crédito', emoji: '💳' },
  debit_card: { label: 'Cartão de Débito', emoji: '💳' },
  cash: { label: 'Dinheiro', emoji: '💵' },
  meal_voucher: { label: 'Vale-Refeição', emoji: '🎟️' },
  food_voucher: { label: 'Vale-Alimentação', emoji: '🍽️' },
  picpay: { label: 'PicPay', emoji: '💚' },
  bank_transfer: { label: 'Transferência Bancária', emoji: '🏦' },
  payment_link: { label: 'Link de Pagamento', emoji: '🔗' },
};
