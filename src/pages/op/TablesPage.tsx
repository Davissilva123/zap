import { useEffect, useState, useCallback } from 'react';
import { db } from '../../lib/db';
import { useRestaurantId } from '../../lib/auth';
import type { RestaurantTable, Category, MenuItem, Order } from '../../lib/types';
import {
  LayoutGrid, ArrowLeft, Plus, Minus, ShoppingCart,
  CheckCircle2, Loader2, ChefHat, Inbox, Receipt,
  XCircle, AlertTriangle,
} from 'lucide-react';

type CartEntry = { item: MenuItem; qty: number };
type View = 'tables' | 'ordering';

const OPEN_STATUSES = ['PENDING', 'PREPARING', 'DELIVERING'];

export default function OpTablesPage() {
  const restaurantId = useRestaurantId();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [view, setView] = useState<View>('tables');
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [filterCat, setFilterCat] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const [t, o, c, i] = await Promise.all([
      db.getTables(restaurantId),
      db.getOrders(restaurantId),
      db.getCategories(restaurantId),
      db.getMenuItems(restaurantId),
    ]);
    setTables(t.filter(x => x.active));
    setOrders(o);
    setCategories(c);
    setItems(i.filter(x => x.available));
    setLoadingData(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const getActiveOrder = (tableName: string): Order | null =>
    orders.find(o => o.tableName === tableName && OPEN_STATUSES.includes(o.status)) ?? null;

  const openTable = (table: RestaurantTable) => {
    setSelectedTable(table);
    setActiveOrder(getActiveOrder(table.name));
    setCart([]);
    setFilterCat('');
    setFeedback(null);
    setView('ordering');
  };

  const backToTables = () => {
    setView('tables');
    setSelectedTable(null);
    setActiveOrder(null);
    setCart([]);
  };

  // Cart helpers
  const addToCart = (item: MenuItem) =>
    setCart(prev => {
      const ex = prev.find(e => e.item.id === item.id);
      return ex ? prev.map(e => e.item.id === item.id ? { ...e, qty: e.qty + 1 } : e) : [...prev, { item, qty: 1 }];
    });

  const removeFromCart = (itemId: string) =>
    setCart(prev => {
      const ex = prev.find(e => e.item.id === itemId);
      if (!ex) return prev;
      return ex.qty === 1 ? prev.filter(e => e.item.id !== itemId) : prev.map(e => e.item.id === itemId ? { ...e, qty: e.qty - 1 } : e);
    });

  const cartQty = (itemId: string) => cart.find(e => e.item.id === itemId)?.qty ?? 0;
  const cartTotal = cart.reduce((s, e) => s + e.item.price * e.qty, 0);
  const cartCount = cart.reduce((s, e) => s + e.qty, 0);
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  // ── Open new comanda ────────────────────────────────────
  const openComanda = async () => {
    if (!restaurantId || !selectedTable || cart.length === 0) return;
    setActionLoading(true);
    try {
      const newOrder = await db.addOrder({
        userId: restaurantId,
        items: cart.map(e => ({ ...e.item, quantity: e.qty })),
        total: cartTotal,
        discount: 0,
        status: 'PENDING',
        customerName: `Mesa ${selectedTable.name}`,
        customerPhone: '',
        paymentMethod: 'cash',
        deliveryType: 'table',
        deliveryAddress: null,
        tableName: selectedTable.name,
        pixTxId: '',
        pixQrCode: '',
        pixCopyPaste: '',
        paidAt: null,
      });
      setCart([]);
      setActiveOrder(newOrder);
      setFeedback({ type: 'ok', msg: 'Comanda aberta! Itens enviados para a cozinha.' });
      await load();
    } catch (e) {
      setFeedback({ type: 'err', msg: String(e) });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Add items to existing comanda ───────────────────────
  const addToComanda = async () => {
    if (!activeOrder || cart.length === 0) return;
    setActionLoading(true);
    try {
      const merged = [...activeOrder.items];
      cart.forEach(({ item, qty }) => {
        const idx = merged.findIndex(i => i.id === item.id);
        if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + qty };
        else merged.push({ ...item, quantity: qty });
      });
      const newTotal = merged.reduce((s, i) => s + i.price * i.quantity, 0);
      await db.updateOrder(activeOrder.id, { items: merged, total: newTotal });
      const updated = { ...activeOrder, items: merged, total: newTotal };
      setActiveOrder(updated);
      setCart([]);
      setFeedback({ type: 'ok', msg: 'Itens adicionados à comanda!' });
      await load();
    } catch (e) {
      setFeedback({ type: 'err', msg: String(e) });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Close comanda ───────────────────────────────────────
  const closeComanda = async () => {
    if (!activeOrder || !selectedTable) return;
    if (!confirm(`Fechar comanda da Mesa ${selectedTable.name}?\nTotal: ${fmt(activeOrder.total)}`)) return;
    setActionLoading(true);
    try {
      await db.updateOrder(activeOrder.id, { status: 'COMPLETED' });
      setFeedback({ type: 'ok', msg: `Comanda da Mesa ${selectedTable.name} fechada.` });
      await load();
      backToTables();
    } catch (e) {
      setFeedback({ type: 'err', msg: String(e) });
    } finally {
      setActionLoading(false);
    }
  };

  const visibleItems = filterCat ? items.filter(i => i.categoryId === filterCat) : items;
  const isOccupied = (t: RestaurantTable) => !!getActiveOrder(t.name);
  const occupiedOrder = (t: RestaurantTable) => getActiveOrder(t.name);

  // ══════════════════════════════════════════════════════════
  // ORDERING VIEW
  // ══════════════════════════════════════════════════════════
  if (view === 'ordering' && selectedTable) {
    const isNew = !activeOrder;
    const existingTotal = activeOrder?.total ?? 0;
    const grandTotal = existingTotal + cartTotal;

    return (
      <div className="animate-fade-in space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={backToTables} className="p-2 rounded-xl hover:bg-slate-200 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isNew ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              <LayoutGrid className={`w-5 h-5 ${isNew ? 'text-emerald-600' : 'text-amber-600'}`} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 leading-none">Mesa {selectedTable.name}</h1>
              <p className={`text-xs mt-0.5 font-medium ${isNew ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isNew ? 'Mesa livre — nova comanda' : `Comanda aberta · Total atual ${fmt(existingTotal)}`}
              </p>
            </div>
          </div>
          {!isNew && (
            <button
              onClick={closeComanda}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Fechar comanda
            </button>
          )}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium ${feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
            {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            {feedback.msg}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Left: categories + items */}
          <div className="flex-1 min-w-0 space-y-4 w-full">

            {/* Existing order items */}
            {activeOrder && activeOrder.items.length > 0 && (
              <div className="card p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" /> Comanda atual
                </p>
                {activeOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.emoji}</span>
                      <span className="text-sm text-slate-700 font-medium">{item.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">x{item.quantity}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{fmt(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1">
                  <span className="text-xs font-bold text-slate-500">Subtotal</span>
                  <span className="text-sm font-extrabold text-slate-900">{fmt(existingTotal)}</span>
                </div>
              </div>
            )}

            {/* Category tabs */}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterCat('')} className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all ${!filterCat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                Todos
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.id)} className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all ${filterCat === cat.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>

            {/* Item grid */}
            {visibleItems.length === 0 ? (
              <div className="text-center py-12">
                <Inbox className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Nenhum item nesta categoria</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {visibleItems.map(item => {
                  const qty = cartQty(item.id);
                  return (
                    <div key={item.id} className={`card p-3 flex flex-col gap-2 transition-all ${qty > 0 ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}>
                      {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-20 object-cover rounded-xl" />}
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{item.emoji} {item.name}</p>
                        {item.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>}
                        <p className="text-emerald-600 font-bold text-sm mt-1">{fmt(item.price)}</p>
                      </div>
                      <div className="flex items-center">
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

          {/* Right: cart + actions */}
          <div className="w-full lg:w-64 lg:flex-shrink-0 space-y-3 lg:sticky lg:top-4">
            {/* New items cart */}
            <div className="card p-4 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-500" />
                {isNew ? 'Pedido' : 'Adicionar à comanda'}
              </h3>

              {cart.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-3">Selecione itens ao lado</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {cart.map(e => (
                      <div key={e.item.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-700 font-medium truncate flex-1">{e.item.emoji} {e.item.name} x{e.qty}</span>
                        <span className="text-xs font-bold text-slate-900 flex-shrink-0">{fmt(e.item.price * e.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 pt-2 flex justify-between">
                    <span className="text-xs font-semibold text-slate-600">{isNew ? 'Total' : 'A adicionar'}</span>
                    <span className="text-sm font-extrabold text-emerald-600">{fmt(cartTotal)}</span>
                  </div>
                  {!isNew && (
                    <div className="flex justify-between bg-slate-50 rounded-xl p-2">
                      <span className="text-xs text-slate-500">Novo total</span>
                      <span className="text-sm font-extrabold text-slate-900">{fmt(grandTotal)}</span>
                    </div>
                  )}
                </>
              )}

              {/* Primary action */}
              {isNew ? (
                <button
                  onClick={openComanda}
                  disabled={cart.length === 0 || actionLoading}
                  className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChefHat className="w-4 h-4" />}
                  Abrir comanda
                </button>
              ) : (
                <button
                  onClick={addToComanda}
                  disabled={cart.length === 0 || actionLoading}
                  className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Adicionar à comanda
                </button>
              )}
            </div>

            {/* Close comanda (only for occupied tables) */}
            {!isNew && (
              <button
                onClick={closeComanda}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Fechar comanda · {fmt(existingTotal + cartTotal)}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // TABLE GRID
  // ══════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Mesas</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Selecione uma mesa para abrir ou gerenciar a comanda</p>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-4 rounded-2xl border text-sm font-medium ${feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
          {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {loadingData ? (
        <div className="text-center py-16"><Loader2 className="w-7 h-7 animate-spin text-emerald-500 mx-auto" /></div>
      ) : tables.length === 0 ? (
        <div className="card p-16 text-center">
          <LayoutGrid className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma mesa cadastrada</p>
          <p className="text-slate-400 text-sm mt-1">O administrador precisa cadastrar as mesas no painel</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tables.map(table => {
            const occupied = isOccupied(table);
            const order = occupiedOrder(table);
            return (
              <button
                key={table.id}
                onClick={() => openTable(table)}
                className={`card p-5 flex flex-col items-center gap-3 transition-all group text-center cursor-pointer hover:ring-2 hover:ring-offset-2 ${occupied ? 'hover:ring-amber-400 bg-amber-50/40' : 'hover:ring-emerald-400'}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${occupied ? 'bg-amber-100 group-hover:bg-amber-200' : 'bg-emerald-100 group-hover:bg-emerald-200'}`}>
                  <LayoutGrid className={`w-6 h-6 ${occupied ? 'text-amber-600' : 'text-emerald-600'}`} />
                </div>
                <div className="w-full">
                  <p className="font-bold text-slate-900 text-base">Mesa {table.name}</p>
                  {occupied && order ? (
                    <>
                      <p className="text-xs font-semibold text-amber-600 mt-0.5">● Ocupada</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {order.items.reduce((s, i) => s + i.quantity, 0)} itens · {fmt(order.total)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-semibold text-emerald-600 mt-0.5">● Livre</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-400 pt-2">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Mesa livre</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Comanda aberta</span>
      </div>
    </div>
  );
}
