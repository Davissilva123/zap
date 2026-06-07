const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface MpPixResult {
  txId: string;
  qrCode: string;
  qrCodeBase64: string;
  amount: number;
}

export interface MpStatusResult {
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export async function createMpPixCharge(
  accessToken: string,
  amount: number,
  description: string,
  payerEmail: string
): Promise<MpPixResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ accessToken, amount, description, payerEmail }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Falha ao criar cobrança Mercado Pago');
  }
  return res.json();
}

export async function checkMpPayment(
  accessToken: string,
  txId: string
): Promise<MpStatusResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-check-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ accessToken, txId }),
  });
  if (!res.ok) return { status: 'pending' };
  return res.json();
}

export async function cancelMpPayment(
  accessToken: string,
  txId: string
): Promise<void> {
  await fetch(`${SUPABASE_URL}/functions/v1/mp-cancel-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ accessToken, txId }),
  });
}
