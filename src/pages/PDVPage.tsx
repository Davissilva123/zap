import { useEffect, useState, useRef } from 'react';
import { useAuth, useRestaurantId } from '../lib/auth';
import { db } from '../lib/db';
import type { MenuItem, Category, Order, PaymentMethod, CashSession } from '../lib/types';
import { isSerialSupported, printReceiptSerial, printOrder } from '../lib/print';
import { isScaleSupported, readScaleWeight, formatWeight } from '../lib/scale';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Scale, X, CheckCircle, Keyboard, LayoutGrid, Lock,
} from 'lucide-react';

const PAYMENT_OPTS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash',        label: 'Dinheiro',      icon: '💵' },
  { value: 'pix',         label: 'PIX',           icon: '📱' },
  { value: 'credit_card', label: 'Crédito',       icon: '💳' },
  { value: 'debit_card',  label: 'Débito',        icon: '💳' },
  { value: 'meal_voucher',label: 'Vale Refeição',  icon: '🎫' },
];

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  weight?: number; // grams, for weighted items
}

function fmt(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}` }

export default function PDVPage() {
  const { user: _user } = useAuth();
  const restaurantId = useRestaurantId();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [payModal, setPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNum, setTableNum] = useState('');
  const [deliveryType, setDeliveryType] = useState<'table' | 'pickup'>('table');
  const [completing, setCompleting] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<import('../lib/types').RestaurantSettings | null>(null);
  const [scaleLoading, setScaleLoading] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [cashSession, setCashSession] = useState<CashSession | null | undefined>(undefined); // undefined = loading
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      db.getMenuItems(restaurantId),
      db.getCategories(restaurantId),
      db.getSettings(restaurantId),
      db.getCurrentCashSession(restaurantId),
    ]).then(([its, cats, s, sess]) => {
      setItems(its.filter(i => i.available));
      setCategories(cats);
      setSettings(s);
      setCashSession(sess);
    });
  }, [restaurantId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'F2' || (e.key === '/' && !inInput)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setPayModal(false);
        setSearch('');
        searchRef.current?.blur();
      }
      if (e.key === 'F10') { e.preventDefault(); if (cart.length > 0 && cashSession) setPayModal(true); }
      if (e.key === 'Delete' && !inInput) {
        setCart(prev => prev.slice(0, -1));
      }
      if (e.key === 'F1') { e.preventDefault(); setShortcuts(s => !s); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart]);

  const filtered = items.filter(i => {
    const matchCat = !catFilter || i.categoryId === catFilter;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const addToCart = (item: MenuItem, weight?: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id && !weight);
      if (existing && !weight) return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItem: item, quantity: 1, weight }];
    });
  };

  const changeQty = (idx: number, delta: number) => {
    setCart(prev => {
      const updated = prev.map((c, i) => i === idx ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c);
      return updated.filter(c => c.quantity > 0);
    });
  };

  const removeItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const cartTotal = cart.reduce((sum, c) => {
    const price = c.weight ? (c.menuItem.price * c.weight / 1000) : (c.menuItem.price * c.quantity);
    return sum + price;
  }, 0);

  const change = Math.max(0, parseFloat(cashReceived.replace(',', '.') || '0') - cartTotal);

  const readScale = async (item: MenuItem) => {
    setScaleLoading(true);
    try {
      const grams = await readScaleWeight();
      addToCart(item, grams);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setScaleLoading(false);
    }
  };

  const completeOrder = async () => {
    if (!restaurantId || cart.length === 0) return;
    setCompleting(true);
    try {
      const orderItems = cart.map(c => ({
        menuItemId: c.menuItem.id,
        name: c.menuItem.name,
        emoji: c.menuItem.emoji,
        price: c.weight ? (c.menuItem.price * c.weight / 1000) : c.menuItem.price,
        quantity: c.weight ? 1 : c.quantity,
        selectedOptions: [],
      }));

      const order = await db.addOrder({
        userId: restaurantId,
        items: orderItems,
        total: cartTotal,
        discount: 0,
        status: 'PAID',
        customerName: customerName || 'Cliente Balcão',
        customerPhone: customerPhone || '00000000000',
        paymentMethod: payMethod,
        deliveryType,
        tableName: tableNum || undefined,
        deliveryAddress: null,
        notes: '',
        pixTxId: '',
        pixQrCode: '',
        pixCopyPaste: '',
        paidAt: new Date().toISOString(),
      });

      if (payMethod === 'cash' && cashSession) {
        await db.addCashEntry(
          restaurantId,
          cashSession.id,
          'sale',
          cartTotal,
          `Venda PDV #${order.id.slice(-6).toUpperCase()}`,
        );
      }

      setLastOrder(order);
      if (settings) {
        if (isSerialSupported()) {
          printReceiptSerial(order, settings).catch(() => printOrder(order, settings));
        } else {
          printOrder(order, settings);
        }
      }

      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setTableNum('');
      setCashReceived('');
      setPayModal(false);
      setTimeout(() => setLastOrder(null), 4000);
    } catch (err) {
      alert('Erro ao finalizar pedido: ' + (err as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? '';

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-100 overflow-hidden">
      {/* Mobile tab bar */}
      <div className="lg:hidden flex border-b border-slate-200 bg-white flex-shrink-0">
        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mobileTab === 'catalog' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500'}`}
        >
          <LayoutGrid size={15} /> Cardápio
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mobileTab === 'cart' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500'}`}
        >
          <ShoppingCart size={15} /> Carrinho
          {cart.length > 0 && <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full px-1.5">{cart.length}</span>}
        </button>
      </div>

      {/* Left: Product grid */}
      <div className={`flex-1 flex flex-col min-w-0 ${mobileTab === 'cart' ? 'hidden lg:flex' : ''}`}>
        {/* Toolbar */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto... (F2)"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto max-w-lg">
            <button
              onClick={() => setCatFilter('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${!catFilter ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCatFilter(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${catFilter === cat.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShortcuts(s => !s)}
            className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
            title="Atalhos (F1)"
          >
            <Keyboard size={16} />
          </button>
        </div>

        {/* Keyboard shortcuts panel */}
        {shortcuts && (
          <div className="bg-slate-800 text-white px-4 py-2 flex gap-6 text-xs flex-wrap">
            {[['F2 ou /', 'Buscar'], ['F10', 'Finalizar'], ['Delete', 'Remover último'], ['Esc', 'Fechar']].map(([k, d]) => (
              <span key={k}><kbd className="bg-slate-600 px-1.5 py-0.5 rounded text-[10px]">{k}</kbd> {d}</span>
            ))}
          </div>
        )}

        {/* Cash session banner */}
        {cashSession === null && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 text-red-700 text-sm">
            <Lock size={14} className="flex-shrink-0" />
            <span>Caixa fechado — acesse <strong>Caixa</strong> para abrir uma sessão antes de vender.</span>
          </div>
        )}

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <LayoutGrid size={32} className="opacity-30" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map(item => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-white rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500 relative"
                >
                  {item.stock === 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 rounded-full">ESGOTADO</span>
                  )}
                  {item.promoPrice && (
                    <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 rounded-full">PROMO</span>
                  )}
                  <div className="text-3xl mb-2">{item.emoji}</div>
                  <p className="text-sm font-medium text-slate-800 leading-tight line-clamp-2">{item.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{catName(item.categoryId)}</p>
                  <p className="text-emerald-600 font-bold text-sm mt-1">{fmt(item.promoPrice ?? item.price)}</p>
                  {isScaleSupported() && (
                    <button
                      onClick={e => { e.stopPropagation(); readScale(item); }}
                      disabled={scaleLoading}
                      className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-600"
                    >
                      <Scale size={10} /> Pesar
                    </button>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className={`lg:w-80 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col ${mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex-1'}`}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <ShoppingCart size={18} className="text-emerald-600" />
          <span className="font-semibold text-slate-800">Carrinho</span>
          {cart.length > 0 && (
            <span className="ml-auto bg-emerald-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{cart.length}</span>
          )}
        </div>

        {/* Customer + Table */}
        <div className="px-3 py-2 border-b border-slate-100 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setDeliveryType('table')}
              className={`flex-1 py-1 rounded-lg text-xs font-medium ${deliveryType === 'table' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              🪑 Mesa
            </button>
            <button
              onClick={() => setDeliveryType('pickup')}
              className={`flex-1 py-1 rounded-lg text-xs font-medium ${deliveryType === 'pickup' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              🏠 Balcão
            </button>
          </div>
          {deliveryType === 'table' && (
            <input
              value={tableNum}
              onChange={e => setTableNum(e.target.value)}
              placeholder="Número da mesa"
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          )}
          <input
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="Nome do cliente (opcional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
              <ShoppingCart size={28} className="opacity-25" />
              <p className="text-sm">Carrinho vazio</p>
            </div>
          ) : (
            cart.map((c, idx) => {
              const price = c.weight ? (c.menuItem.price * c.weight / 1000) : (c.menuItem.price * c.quantity);
              return (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-lg">{c.menuItem.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{c.menuItem.name}</p>
                    {c.weight
                      ? <p className="text-[10px] text-slate-500">{formatWeight(c.weight)}</p>
                      : (
                        <div className="flex items-center gap-1 mt-0.5">
                          <button onClick={() => changeQty(idx, -1)} className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center"><Minus size={10} /></button>
                          <span className="text-xs font-bold w-5 text-center">{c.quantity}</span>
                          <button onClick={() => changeQty(idx, 1)} className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center"><Plus size={10} /></button>
                        </div>
                      )
                    }
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-emerald-600">{fmt(price)}</span>
                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Total & checkout */}
        <div className="px-4 py-3 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Total</span>
            <span className="text-xl font-bold text-emerald-600">{fmt(cartTotal)}</span>
          </div>
          <button
            disabled={cart.length === 0 || !cashSession}
            onClick={() => setPayModal(true)}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            title={!cashSession ? 'Abra o caixa para finalizar vendas' : undefined}
          >
            {cashSession === null ? <Lock size={18} /> : <CreditCard size={18} />}
            {cashSession === null ? 'Caixa fechado' : 'Finalizar (F10)'}
          </button>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="w-full py-2 text-sm text-slate-500 hover:text-red-500 flex items-center justify-center gap-1"
            >
              <Trash2 size={13} /> Limpar carrinho
            </button>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-bold text-slate-800 text-lg">Finalizar Venda</h2>
              <button onClick={() => setPayModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} /></button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-emerald-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-slate-600 font-medium">Total a pagar</span>
                <span className="text-2xl font-bold text-emerald-600">{fmt(cartTotal)}</span>
              </div>

              {/* Payment method */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Forma de pagamento</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_OPTS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPayMethod(opt.value)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-sm transition-colors ${payMethod === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash change */}
              {payMethod === 'cash' && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Valor recebido</label>
                  <input
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    placeholder="0,00"
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <div className="mt-2 flex justify-between bg-slate-50 rounded-lg px-4 py-2">
                    <span className="text-slate-600">Troco</span>
                    <span className={`font-bold ${change > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{fmt(change)}</span>
                  </div>
                </div>
              )}

              {/* Quick amounts for cash */}
              {payMethod === 'cash' && (
                <div className="flex gap-2">
                  {[cartTotal, Math.ceil(cartTotal / 10) * 10, Math.ceil(cartTotal / 50) * 50, Math.ceil(cartTotal / 100) * 100].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map(v => (
                    <button key={v} onClick={() => setCashReceived(v.toFixed(2).replace('.', ','))} className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-700">
                      {fmt(v)}
                    </button>
                  ))}
                </div>
              )}

              <input
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Telefone do cliente (opcional)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              <button onClick={() => setPayModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium">
                Cancelar
              </button>
              <button
                onClick={completeOrder}
                disabled={completing}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-2"
              >
                {completing ? 'Processando...' : <><CheckCircle size={18} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {lastOrder && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white rounded-xl shadow-lg px-5 py-3 flex items-center gap-3 animate-bounce">
          <CheckCircle size={20} />
          <div>
            <p className="font-semibold text-sm">Venda realizada!</p>
            <p className="text-xs text-emerald-100">#{lastOrder.id.slice(-6).toUpperCase()} — {fmt(lastOrder.total)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
