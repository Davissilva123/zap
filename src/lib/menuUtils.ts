import type { RestaurantSettings, OrderItem } from './types';

export function isRestaurantOpen(settings: RestaurantSettings): boolean {
  if (settings.manualClosed) return false;
  if (!settings.openingHours || Object.keys(settings.openingHours).length === 0) return true;
  const now = new Date();
  const day = String(now.getDay());
  const hours = settings.openingHours[day];
  if (!hours?.open) return false;
  const [fh, fm] = hours.from.split(':').map(Number);
  const [th, tm] = hours.to.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= fh * 60 + fm && cur <= th * 60 + tm;
}

export function calcCartSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    const extras = item.selectedOptions
      ? Object.values(item.selectedOptions).reduce((s, o) => s + (o.priceDelta ?? 0), 0)
      : 0;
    return sum + (item.price + extras) * item.quantity;
  }, 0);
}

export function calcCartTotal({
  subtotal,
  deliveryFee,
  isDelivery,
  couponDiscount,
  cashbackApplied,
}: {
  subtotal: number;
  deliveryFee: number;
  isDelivery: boolean;
  couponDiscount: number;
  cashbackApplied: number;
}): number {
  return Math.max(0, subtotal + (isDelivery ? deliveryFee : 0) - couponDiscount - cashbackApplied);
}

export function clampCashback(cashbackBalance: number, amountBeforeCashback: number): number {
  return Math.min(cashbackBalance, Math.max(0, amountBeforeCashback));
}
