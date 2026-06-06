import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { useRestaurantId } from '../../lib/auth';
import type { RestaurantTable, Category, MenuItem, Order } from '../../lib/types';
import { LayoutGrid, ArrowLeft, Plus, Minus, ShoppingCart, CheckCircle2, Loader2, ChefHat, Inbox } from 'lucide-react';

type CartEntry = { item: MenuItem; qty: number };
type PayMethod = Order['paymentMethod'];

const PAY_OPTIONS: { value: PayMethod; label: string; emoji: string }[] = [
  { value: 'cash', label: 'Dinheiro', emoji: '💵' },
  { value: 'credit_card', label: 'Crédito', emoji: '💳' },
  { value: 'debit_card', label: 'Débito', emoji: '💳' },
  { value: 'pix', label: 'PIX', emoji: '⚡' },
];

export default function OpTablesPage() {
  const restaurantId = useRestaurantId();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [filterCat, setFilterCat] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null); // table name after placing

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      db.getTables(restaurantId),
      db.getCategories(restaurantId),
      db.getMenuItems(restaurantId),
    ]).then(([t, c, i]) => {
      setTables(t.filter(x => x.active));
      setCategories(c);
      setItems(i.filter(x => x.available));
    }).finally(() => setLoadingData(false));
  }, [restaurantId]);

  const openTable = (table: RestaurantTable) => {
    setSelectedTable(table);
    setCart([]);
    setCustomerName('');
    setPayMethod('cash');
    setFilterCat('');
    setSuccess(null);
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(e => e.item.id === item.id);
      if (existing) return prev.map(e => e.item.id === item.id ? { ...e, qty: e.qty + 1 } : e);
      return [...prev, { item, qty: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(e => e.item.id === itemId);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter(e => e.item.id !== itemId);
      return prev.map(e => e.item.id === itemId ? { ...e, qty: e.qty - 1 } : e);
    });
  };

  const cartQty = (itemId: string) => cart.find(e => e.item.id === itemId)?.qty ?? 0;
  const cartTotal = cart.reduce((s, e) => s + e.item.price * e.qty, 0);
  const cartCount = cart.reduce((s, e) => s + e.qty, 0);

  const placeOrder = async () => {
    if (!restaurantId || !selectedTable || cart.length === 0) return;
    setPlacing(true);
    try {
      await db.addOrder({
        userId: restaurantId,
        items: cart.map(e => ({ ...e.item, quantity: e.qty })),
        total: cartTotal,
        discount: 0,
        status: 'PENDING',
        customerName: customerName.trim() || `Mesa ${selectedTable.name}`,
        customerPhone: '',
        paymentMethod: payMethod,
        deliveryType: 'table',
        deliveryAddress: null,
        tableName: selectedTable.name,
        pixTxId: null,
        pixQrCode: null,
        pixCopyPaste: null,
        paidAt: null,
      });
      setSuccess(selectedTable.name);
      setSelectedTable(null);
      setCart([]);
    } catch (e) {
      alert('Erro ao registrar pedido: ' + String(e));
    } finally {
      setPlacing(false);
    }
  };

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  // ── Success screen ──────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-slate-900">Pedido enviado!</p>
          <p className="text-slate-500 mt-1 text-sm">Mesa <strong>{success}</strong> — pedido na fila de preparo</p>
        </div>
        <button onClick={() => setSuccess(null)} className="btn-primary px-8">
          Voltar às mesas
        </button>
      </div>
    );
  }

  // ── Ordering screen ─────────────────────────────────────
  if (selectedTable) {
    const visibleItems = filterCat ? items.filter(i => i.categoryId === filterCat) : items;

    return (
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setSelectedTable(null)} className="p-2 rounded-xl hover:bg-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">Mesa {selectedTable.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">Selecione os itens do pedido</p>
            </div>
          </div>
          {cartCount > 0 && (
            <div className="ml-auto flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow">
              <ShoppingCart className="w-4 h-4" />
              {cartCount} {cartCount === 1 ? 'item' : 'itens'} · {fmt(cartTotal)}
            </div>
          )}
        </div>

        <div className="flex gap-5 items-start">
          {/* Items panel */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Category tabs */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterCat('')}
                className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all ${!filterCat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCat(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all ${filterCat === cat.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>

            {/* Items grid */}
            {visibleItems.length === 0 ? (
              <div className="text-center py-16">
                <Inbox className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Nenhum item nesta categoria</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {visibleItems.map(item => {
                  const qty = cartQty(item.id);
                  return (
                    <div key={item.id} className={`card p-3 flex flex-col gap-2 transition-all ${qty > 0 ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}>
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-24 object-cover rounded-xl" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{item.emoji} {item.name}</p>
                        {item.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>}
                        <p className="text-emerald-600 font-bold text-sm mt-1">{fmt(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 justify-between">
                        {qty > 0 ? (
                          <div className="flex items-center gap-2 w-full justify-between">
                            <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                              <Minus className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                            <span className="font-bold text-slate-900 text-sm">{qty}</span>
                            <button onClick={() => addToCart(item)} className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-colors">
                              <Plus className="w-3.5 h-3.5 text-white" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(item)} className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart panel */}
          <div className="w-72 flex-shrink-0 space-y-4 sticky top-4">
            <div className="card p-4 space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-500" /> Resumo do pedido
              </h3>

              {cart.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-4">Nenhum item selecionado</p>
              ) : (
                <div className="space-y-2">
                  {cart.map(e => (
                    <div key={e.item.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm">{e.item.emoji}</span>
                        <span className="text-xs text-slate-700 font-medium truncate">{e.item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-400">x{e.qty}</span>
                        <span className="text-xs font-bold text-slate-900">{fmt(e.item.price * e.qty)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Total</span>
                    <span className="text-base font-extrabold text-emerald-600">{fmt(cartTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Customer name */}
            <div className="card p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome do cliente</label>
                <input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder={`Mesa ${selectedTable.name}`}
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pagamento</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PAY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPayMethod(opt.value)}
                      className={`py-2 px-2 rounded-xl border-2 text-[11px] font-semibold transition-all text-center ${payMethod === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={placeOrder}
                disabled={cart.length === 0 || placing}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChefHat className="w-4 h-4" />}
                {placing ? 'Enviando...' : 'Confirmar pedido'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Table grid ─────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Mesas</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Selecione a mesa para registrar o pedido</p>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">Pedido da Mesa <strong>{success}</strong> enviado com sucesso!</p>
        </div>
      )}

      {loadingData ? (
        <div className="text-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500 mx-auto" />
        </div>
      ) : tables.length === 0 ? (
        <div className="card p-16 text-center">
          <LayoutGrid className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma mesa cadastrada</p>
          <p className="text-slate-400 text-sm mt-1">O administrador precisa cadastrar as mesas no painel</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tables.map(table => (
            <button
              key={table.id}
              onClick={() => openTable(table)}
              className="card p-5 flex flex-col items-center gap-3 hover:ring-2 hover:ring-emerald-400 hover:ring-offset-2 transition-all group text-center cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center transition-colors">
                <LayoutGrid className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-base">Mesa {table.name}</p>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Atender →</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
