import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRestaurantOpen, calcCartSubtotal, calcCartTotal, clampCashback, calcDeliveryFee, meetsMinimumOrder, calcCashbackEarned } from './menuUtils';
import type { RestaurantSettings } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fakeSettings(overrides: Partial<RestaurantSettings> = {}): RestaurantSettings {
  return {
    userId: 'u1',
    name: 'Test',
    slug: 'test',
    accentColor: '#059669',
    description: '',
    address: '',
    phone: '',
    logoUrl: '',
    coverUrl: '',
    xgateEmail: '',
    xgatePassword: '',
    paymentMethods: ['pix'],
    whatsappApiToken: '',
    whatsappPhoneNumberId: '',
    whatsappEnabled: false,
    openingHours: {},
    deliveryTime: '',
    deliveryFee: 0,
    deliveryNeighborhoods: [],
    minimumOrder: 0,
    manualClosed: false,
    cashbackEnabled: false,
    cashbackPercent: 0,
    scheduleEnabled: false,
    scheduleMinutesAhead: 0,
    mercadoPagoToken: '',
    freeShippingEnabled: false,
    freeShippingMinOrder: 0,
    ...overrides,
  } as RestaurantSettings;
}

function mockTime(hour: number, minute: number) {
  const d = new Date(2024, 0, 1, hour, minute, 0); // Monday = 1
  vi.setSystemTime(d);
}

// ── isRestaurantOpen ─────────────────────────────────────────────────────────

describe('isRestaurantOpen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retorna false quando manualClosed=true independente do horário', () => {
    mockTime(12, 0);
    const s = fakeSettings({
      manualClosed: true,
      openingHours: { '1': { open: true, from: '08:00', to: '22:00' } },
    });
    expect(isRestaurantOpen(s)).toBe(false);
  });

  it('retorna true quando não há horários cadastrados', () => {
    mockTime(3, 0);
    expect(isRestaurantOpen(fakeSettings({ openingHours: {} }))).toBe(true);
  });

  it('retorna false quando o dia está marcado como fechado', () => {
    mockTime(12, 0); // Monday
    const s = fakeSettings({
      openingHours: { '1': { open: false, from: '08:00', to: '22:00' } },
    });
    expect(isRestaurantOpen(s)).toBe(false);
  });

  it('retorna true dentro do horário de funcionamento', () => {
    mockTime(13, 30); // Monday 13:30
    const s = fakeSettings({
      openingHours: { '1': { open: true, from: '08:00', to: '22:00' } },
    });
    expect(isRestaurantOpen(s)).toBe(true);
  });

  it('retorna false antes da abertura', () => {
    mockTime(7, 59); // Monday 07:59
    const s = fakeSettings({
      openingHours: { '1': { open: true, from: '08:00', to: '22:00' } },
    });
    expect(isRestaurantOpen(s)).toBe(false);
  });

  it('retorna false após o fechamento', () => {
    mockTime(22, 1); // Monday 22:01
    const s = fakeSettings({
      openingHours: { '1': { open: true, from: '08:00', to: '22:00' } },
    });
    expect(isRestaurantOpen(s)).toBe(false);
  });
});

// ── calcCartSubtotal ─────────────────────────────────────────────────────────

describe('calcCartSubtotal', () => {
  it('soma preço × quantidade de itens simples', () => {
    const items = [
      { menuItemId: '1', name: 'X-Burger', price: 20, quantity: 2, selectedOptions: {} },
      { menuItemId: '2', name: 'Fries', price: 10, quantity: 1, selectedOptions: {} },
    ] as Parameters<typeof calcCartSubtotal>[0];
    expect(calcCartSubtotal(items)).toBe(50);
  });

  it('inclui adicionais (selectedOptions.priceDelta)', () => {
    const items = [
      {
        menuItemId: '1',
        name: 'Pizza',
        price: 50,
        quantity: 1,
        selectedOptions: {
          borda: { name: 'Borda recheada', priceDelta: 8 },
          tamanho: { name: 'Grande', priceDelta: 10 },
        },
      },
    ] as unknown as Parameters<typeof calcCartSubtotal>[0];
    expect(calcCartSubtotal(items)).toBe(68);
  });

  it('retorna 0 para carrinho vazio', () => {
    expect(calcCartSubtotal([])).toBe(0);
  });
});

// ── calcCartTotal ────────────────────────────────────────────────────────────

describe('calcCartTotal', () => {
  it('soma frete quando isDelivery=true', () => {
    expect(calcCartTotal({ subtotal: 100, deliveryFee: 8, isDelivery: true, couponDiscount: 0, cashbackApplied: 0 })).toBe(108);
  });

  it('não soma frete quando isDelivery=false', () => {
    expect(calcCartTotal({ subtotal: 100, deliveryFee: 8, isDelivery: false, couponDiscount: 0, cashbackApplied: 0 })).toBe(100);
  });

  it('aplica desconto de cupom', () => {
    expect(calcCartTotal({ subtotal: 100, deliveryFee: 0, isDelivery: false, couponDiscount: 15, cashbackApplied: 0 })).toBe(85);
  });

  it('aplica cashback', () => {
    expect(calcCartTotal({ subtotal: 100, deliveryFee: 0, isDelivery: false, couponDiscount: 0, cashbackApplied: 20 })).toBe(80);
  });

  it('nunca retorna valor negativo quando cashback/cupom cobre tudo', () => {
    expect(calcCartTotal({ subtotal: 10, deliveryFee: 0, isDelivery: false, couponDiscount: 0, cashbackApplied: 50 })).toBe(0);
  });

  it('combina cupom + cashback + frete', () => {
    // 100 + 8 frete - 10 cupom - 20 cashback = 78
    expect(calcCartTotal({ subtotal: 100, deliveryFee: 8, isDelivery: true, couponDiscount: 10, cashbackApplied: 20 })).toBe(78);
  });
});

// ── clampCashback ────────────────────────────────────────────────────────────

describe('clampCashback', () => {
  it('não aplica mais cashback do que o saldo disponível', () => {
    expect(clampCashback(10, 100)).toBe(10);
  });

  it('não aplica mais cashback do que o total do pedido', () => {
    expect(clampCashback(100, 30)).toBe(30);
  });

  it('retorna 0 quando o total é 0', () => {
    expect(clampCashback(50, 0)).toBe(0);
  });
});

// ── isRestaurantOpen — edge cases ─────────────────────────────────────────────

describe('isRestaurantOpen — horários limite', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retorna true exatamente no horário de abertura', () => {
    mockTime(8, 0);
    const s = fakeSettings({ openingHours: { '1': { open: true, from: '08:00', to: '22:00' } } });
    expect(isRestaurantOpen(s)).toBe(true);
  });

  it('retorna true exatamente no horário de fechamento (intervalo fechado <=)', () => {
    mockTime(22, 0);
    const s = fakeSettings({ openingHours: { '1': { open: true, from: '08:00', to: '22:00' } } });
    expect(isRestaurantOpen(s)).toBe(true);
  });

  it('retorna false um minuto após o horário de fechamento', () => {
    mockTime(22, 1);
    const s = fakeSettings({ openingHours: { '1': { open: true, from: '08:00', to: '22:00' } } });
    expect(isRestaurantOpen(s)).toBe(false);
  });

  it('retorna true para estabelecimento aberto dia inteiro (00:00-23:59)', () => {
    mockTime(3, 0);
    const s = fakeSettings({ openingHours: { '1': { open: true, from: '00:00', to: '23:59' } } });
    expect(isRestaurantOpen(s)).toBe(true);
  });
});

// ── calcCartTotal — cenários completos de checkout ───────────────────────────

describe('calcCartTotal — checkout completo', () => {
  it('cupom que excede o subtotal resulta em 0 (sem troco)', () => {
    expect(calcCartTotal({ subtotal: 20, deliveryFee: 0, isDelivery: false, couponDiscount: 50, cashbackApplied: 0 })).toBe(0);
  });

  it('frete gratuito com retirada mesmo quando deliveryFee > 0', () => {
    expect(calcCartTotal({ subtotal: 50, deliveryFee: 10, isDelivery: false, couponDiscount: 0, cashbackApplied: 0 })).toBe(50);
  });

  it('cashback + cupom juntos reduzem o total corretamente', () => {
    // 80 subtotal - 10 cupom - 5 cashback = 65
    expect(calcCartTotal({ subtotal: 80, deliveryFee: 0, isDelivery: false, couponDiscount: 10, cashbackApplied: 5 })).toBe(65);
  });

  it('carrinho com item único e quantidade > 1', () => {
    const items = [
      { menuItemId: '1', name: 'Água', price: 4, quantity: 3, selectedOptions: {} },
    ] as Parameters<typeof calcCartSubtotal>[0];
    expect(calcCartSubtotal(items)).toBe(12);
  });
});

// ── calcDeliveryFee ──────────────────────────────────────────────────────────

describe('calcDeliveryFee', () => {
  it('retorna a taxa normal quando frete grátis está desativado', () => {
    expect(calcDeliveryFee(8, 100, false, 50)).toBe(8);
  });

  it('retorna 0 quando subtotal atinge o mínimo para frete grátis', () => {
    expect(calcDeliveryFee(8, 50, true, 50)).toBe(0);
  });

  it('retorna 0 quando subtotal supera o mínimo para frete grátis', () => {
    expect(calcDeliveryFee(8, 120, true, 50)).toBe(0);
  });

  it('retorna taxa normal quando subtotal está abaixo do mínimo para frete grátis', () => {
    expect(calcDeliveryFee(8, 49, true, 50)).toBe(8);
  });

  it('retorna 0 quando a taxa de entrega é 0', () => {
    expect(calcDeliveryFee(0, 10, false, 0)).toBe(0);
  });
});

// ── meetsMinimumOrder ────────────────────────────────────────────────────────

describe('meetsMinimumOrder', () => {
  it('retorna true quando não há pedido mínimo configurado (0)', () => {
    expect(meetsMinimumOrder(0, 0)).toBe(true);
  });

  it('retorna true quando subtotal exatamente igual ao mínimo', () => {
    expect(meetsMinimumOrder(30, 30)).toBe(true);
  });

  it('retorna true quando subtotal supera o mínimo', () => {
    expect(meetsMinimumOrder(50, 30)).toBe(true);
  });

  it('retorna false quando subtotal está abaixo do mínimo', () => {
    expect(meetsMinimumOrder(29, 30)).toBe(false);
  });

  it('retorna true para carrinho vazio quando mínimo é 0', () => {
    expect(meetsMinimumOrder(0, 0)).toBe(true);
  });
});

// ── calcCashbackEarned ───────────────────────────────────────────────────────

describe('calcCashbackEarned', () => {
  it('retorna 0 quando cashback está desativado (0%)', () => {
    expect(calcCashbackEarned(100, 0)).toBe(0);
  });

  it('calcula 5% de cashback corretamente', () => {
    expect(calcCashbackEarned(100, 5)).toBe(5);
  });

  it('calcula 10% de cashback com valor não inteiro (arredonda para baixo)', () => {
    expect(calcCashbackEarned(33, 10)).toBe(3.3);
  });

  it('retorna 0 para pedido com total 0', () => {
    expect(calcCashbackEarned(0, 10)).toBe(0);
  });

  it('cashback percentual negativo retorna 0', () => {
    expect(calcCashbackEarned(100, -5)).toBe(0);
  });
});

// ── Fluxo completo de checkout ───────────────────────────────────────────────

describe('fluxo completo de checkout — delivery com cupom e cashback', () => {
  it('cenário: delivery R$100, frete R$8, cupom 10%, cashback R$5', () => {
    const subtotal = calcCartSubtotal([
      { menuItemId: '1', name: 'Pizza', price: 50, quantity: 2, selectedOptions: {} },
    ] as Parameters<typeof calcCartSubtotal>[0]);
    expect(subtotal).toBe(100);

    const fee = calcDeliveryFee(8, subtotal, false, 0);
    expect(fee).toBe(8);

    const cashback = clampCashback(5, subtotal + fee);
    const total = calcCartTotal({ subtotal, deliveryFee: fee, isDelivery: true, couponDiscount: 10, cashbackApplied: cashback });
    // 100 + 8 - 10 cupom - 5 cashback = 93
    expect(total).toBe(93);
  });

  it('cenário: retirada com frete grátis ativado, cupom fixo R$20', () => {
    const subtotal = 80;
    const fee = calcDeliveryFee(10, subtotal, true, 50); // frete grátis: subtotal >= 50
    expect(fee).toBe(0);

    const total = calcCartTotal({ subtotal, deliveryFee: fee, isDelivery: false, couponDiscount: 20, cashbackApplied: 0 });
    expect(total).toBe(60);
  });

  it('cenário: cashback ganho após pedido de R$120 a 5%', () => {
    const earned = calcCashbackEarned(120, 5);
    expect(earned).toBe(6);
  });

  it('cenário: pedido abaixo do mínimo bloqueia checkout', () => {
    expect(meetsMinimumOrder(25, 30)).toBe(false);
    expect(meetsMinimumOrder(30, 30)).toBe(true);
  });
});
