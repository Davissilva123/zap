import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/db';
import { createPixCharge, checkPixPayment, createOrder, PAYMENT_METHOD_LABELS } from '../lib/xgate';
import type { Category, MenuItem, RestaurantSettings, OrderItem, PaymentMethod, DeliveryAddress } from '../lib/types';
import { MapPin, Phone, ChefHat, ShoppingCart, Plus, Minus, Trash2, X, Copy, Check, Loader2, QrCode, Truck, ShoppingBag, ArrowLeft } from 'lucide-react';

interface CartItem extends OrderItem {
  categoryId: string;
}

type CheckoutStep = 'cart' | 'delivery' | 'payment' | 'paying' | 'pix' | 'success' | 'error' | 'no-xgate' | 'no-methods' | 'order_placed';

const emptyAddress: DeliveryAddress = { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip: '' };

export default function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState<DeliveryAddress>(emptyAddress);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | ''>('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixTxId, setPixTxId] = useState('');
  const [pixAmount, setPixAmount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [cashChange, setCashChange] = useState('');

  useEffect(() => {
    if (!slug) return;
    const data = db.getPublicMenu(slug);
    if (!data) return;
    setSettings(data.settings);
    setCategories(data.categories);
    setItems(data.items);
    db.addScan(data.settings.userId);
  }, [slug]);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const availablePaymentMethods = settings?.paymentMethods?.filter(m => m) || [];

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, emoji: item.emoji, price: item.price, quantity: 1, categoryId: item.categoryId }];
    });
  };

  const removeFromCart = (menuItemId: string) => setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));

  const updateQty = (menuItemId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(menuItemId);
    setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: qty } : c));
  };

  const validateDeliveryStep = () => {
    if (!customerName.trim()) return 'Nome é obrigatório';
    if (!customerPhone.trim()) return 'Telefone é obrigatório';
    if (deliveryType === 'delivery') {
      if (!address.street.trim()) return 'Rua é obrigatória';
      if (!address.number.trim()) return 'Número é obrigatório';
      if (!address.neighborhood.trim()) return 'Bairro é obrigatório';
      if (!address.city.trim()) return 'Cidade é obrigatória';
    }
    return null;
  };

  const handlePlaceOrder = useCallback(async () => {
    if (!settings) return;
    if (selectedPayment === 'pix') {
      if (!settings.xgateEmail || !settings.xgatePassword) { setStep('no-xgate'); return; }
      setStep('paying');
      setErrorMsg('');
      try {
        const txId = `cardapio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const result = await createPixCharge(settings.xgateEmail, settings.xgatePassword, cartTotal, txId, customerName.trim());
        createOrder(settings.userId, cart, cartTotal, customerName.trim(), customerPhone.trim(), 'pix', deliveryType, deliveryType === 'delivery' ? address : null, result);
        setPixCopyPaste(result.pixCopyPaste);
        setPixQrCode(result.qrCodeImage || result.qrCode);
        setPixTxId(result.txId);
        setPixAmount(cartTotal);
        setStep('pix');
        setPolling(true);
      } catch (err) {
        setErrorMsg(String(err));
        setStep('error');
      }
      return;
    }
    createOrder(settings.userId, cart, cartTotal, customerName.trim(), customerPhone.trim(), selectedPayment as PaymentMethod, deliveryType, deliveryType === 'delivery' ? address : null, null);
    setStep('order_placed');
  }, [settings, cart, cartTotal, customerName, customerPhone, selectedPayment, deliveryType, address]);

  useEffect(() => {
    if (!polling || !settings?.xgateEmail || !pixTxId) return;
    const interval = setInterval(async () => {
      try {
        const result = await checkPixPayment(settings.xgateEmail!, settings.xgatePassword!, pixTxId);
        if (result.status === 'PAID' || result.status === 'CONCLUIDA' || result.status === 'COMPLETED') {
          setPolling(false);
          setStep('success');
        }
      } catch { /* keep polling */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [polling, settings, pixTxId]);

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 gradient-mesh">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <ChefHat className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Cardápio não encontrado</h2>
          <p className="text-slate-400 mt-1 text-sm">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  const accent = settings.accentColor;
  const copyPixCode = () => { navigator.clipboard.writeText(pixCopyPaste); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const closeAndReset = () => {
    setCart([]); setShowCart(false); setStep('cart'); setCustomerName(''); setCustomerPhone('');
    setAddress(emptyAddress); setSelectedPayment(''); setDeliveryType('pickup');
    setPixCopyPaste(''); setPixQrCode(''); setPixTxId(''); setCashChange('');
  };

  const formatAddress = (a: DeliveryAddress) => {
    let parts = [a.street, a.number].filter(Boolean);
    if (a.complement) parts.push(`(${a.complement})`);
    parts.push(a.neighborhood, a.city);
    if (a.state) parts.push(a.state);
    return parts.filter(Boolean).join(', ');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Hero header */}
      <div className="relative overflow-hidden" style={{ backgroundColor: accent }}>
        <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-transparent to-black/10" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full" style={{ backgroundColor: accent, filter: 'brightness(1.3)', opacity: 0.15 }} />
        <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full" style={{ backgroundColor: 'white', opacity: 0.05 }} />
        <div className="relative max-w-lg mx-auto px-6 pt-14 pb-12 text-center">
          <div className="w-[72px] h-[72px] rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-5 ring-1 ring-white/10">
            <ChefHat className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-[26px] font-bold text-white tracking-tight">{settings.name}</h1>
          {settings.description && <p className="text-white/75 mt-2.5 text-sm max-w-sm mx-auto leading-relaxed">{settings.description}</p>}
          <div className="flex items-center justify-center gap-4 mt-4 text-[12px] text-white/60 font-medium">
            {settings.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{settings.address}</span>}
            {settings.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{settings.phone}</span>}
          </div>
        </div>
      </div>

      {/* Cart FAB */}
      {cartCount > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 pl-5 pr-6 py-4 rounded-2xl shadow-2xl text-white transition-all hover:scale-[1.02] active:scale-[0.98] animate-slide-up"
          style={{ backgroundColor: accent }}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold text-[15px]">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
          <span className="bg-white/20 text-[11px] px-2 py-0.5 rounded-full font-semibold">{cartCount}</span>
        </button>
      )}

      {/* Category filter pills */}
      <div className="max-w-lg mx-auto px-4 -mt-5">
        <div className="glass rounded-2xl shadow-elevated p-1.5 flex gap-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveCat('')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${!activeCat ? 'text-white shadow-card' : 'text-slate-500 hover:bg-white/50'}`}
            style={!activeCat ? { backgroundColor: accent } : undefined}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(activeCat === cat.id ? '' : cat.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${activeCat === cat.id ? 'text-white shadow-card' : 'text-slate-500 hover:bg-white/50'}`}
              style={activeCat === cat.id ? { backgroundColor: accent } : undefined}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu items */}
      <div className="max-w-lg mx-auto px-4 py-8 space-y-7">
        {categories
          .filter(c => !activeCat || c.id === activeCat)
          .map(cat => {
            const catItems = items.filter(i => i.categoryId === cat.id);
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                  <span className="text-lg">{cat.emoji}</span> {cat.name}
                  <span className="text-slate-300 font-normal text-sm">{catItems.length}</span>
                </h2>
                <div className="space-y-2.5">
                  {catItems.map(item => {
                    const inCart = cart.find(c => c.menuItemId === item.id);
                    return (
                      <div key={item.id} className="card-hover">
                        <div className="flex items-center gap-3.5 p-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-50/80 flex items-center justify-center text-2xl flex-shrink-0">
                            {item.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 text-[15px]">{item.name}</h3>
                            {item.description && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2 leading-snug">{item.description}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <p className="font-bold text-[15px] tracking-tight" style={{ color: accent }}>
                              R$ {item.price.toFixed(2).replace('.', ',')}
                            </p>
                            {inCart ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => updateQty(item.id, inCart.quantity - 1)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors active:scale-95">
                                  <Minus className="w-3.5 h-3.5 text-slate-500" />
                                </button>
                                <span className="text-sm font-bold w-7 text-center">{inCart.quantity}</span>
                                <button onClick={() => updateQty(item.id, inCart.quantity + 1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-80 transition-colors active:scale-95" style={{ backgroundColor: accent }}>
                                  <Plus className="w-3.5 h-3.5 text-white" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => addToCart(item)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-colors active:scale-95" style={{ backgroundColor: accent }}>
                                <Plus className="w-4 h-4 text-white" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {/* Checkout Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => { if (step === 'cart' || step === 'success' || step === 'order_placed') setShowCart(false); }} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-elevated flex flex-col overflow-hidden animate-slide-in-right">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100/80 flex items-center gap-3">
              {(step === 'delivery' || step === 'payment') && (
                <button onClick={() => setStep(step === 'payment' ? 'delivery' : 'cart')} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100/80">
                  <ArrowLeft className="w-4 h-4 text-slate-400" />
                </button>
              )}
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex-1">
                {step === 'cart' && 'Seu Pedido'}
                {step === 'delivery' && 'Entrega'}
                {step === 'payment' && 'Pagamento'}
                {step === 'paying' && 'Processando...'}
                {step === 'pix' && 'Pagamento PIX'}
                {step === 'success' && 'Pagamento Confirmado'}
                {step === 'order_placed' && 'Pedido Realizado'}
                {step === 'error' && 'Erro'}
                {step === 'no-xgate' && 'PIX indisponível'}
                {step === 'no-methods' && 'Pagamento indisponível'}
              </h3>
              {step === 'cart' && (
                <button onClick={() => setShowCart(false)} className="p-2 rounded-xl hover:bg-slate-100/80 transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* CART */}
              {step === 'cart' && (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.menuItemId} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-base">{item.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                        <p className="text-[12px] text-slate-400">R$ {item.price.toFixed(2).replace('.', ',')} un.</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.menuItemId, item.quantity - 1)} className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center hover:bg-slate-200 active:scale-95"><Minus className="w-3 h-3 text-slate-500" /></button>
                        <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.menuItemId, item.quantity + 1)} className="w-6 h-6 rounded-md flex items-center justify-center hover:opacity-80 active:scale-95" style={{ backgroundColor: accent }}><Plus className="w-3 h-3 text-white" /></button>
                      </div>
                      <p className="text-sm font-bold text-slate-900 w-14 text-right">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                      <button onClick={() => removeFromCart(item.menuItemId)} className="p-1 rounded-md hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  ))}
                  {cart.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Carrinho vazio</p>}
                  {cart.length > 0 && (
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
                      <span className="font-semibold text-slate-700">Total</span>
                      <span className="text-xl font-bold tracking-tight" style={{ color: accent }}>R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* DELIVERY */}
              {step === 'delivery' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Tipo de entrega</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setDeliveryType('pickup')} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2.5 ${deliveryType === 'pickup' ? 'bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`} style={deliveryType === 'pickup' ? { borderColor: accent } : undefined}>
                        <ShoppingBag className="w-5 h-5" style={deliveryType === 'pickup' ? { color: accent } : undefined} />
                        <span className="text-sm font-semibold" style={deliveryType === 'pickup' ? { color: accent } : undefined}>Retirada</span>
                      </button>
                      <button onClick={() => setDeliveryType('delivery')} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2.5 ${deliveryType === 'delivery' ? 'bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`} style={deliveryType === 'delivery' ? { borderColor: accent } : undefined}>
                        <Truck className="w-5 h-5" style={deliveryType === 'delivery' ? { color: accent } : undefined} />
                        <span className="text-sm font-semibold" style={deliveryType === 'delivery' ? { color: accent } : undefined}>Delivery</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nome *</label>
                      <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="input-field" placeholder="Seu nome" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Telefone *</label>
                      <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="input-field" placeholder="(11) 99999-0000" />
                    </div>
                  </div>
                  {deliveryType === 'delivery' && (
                    <div className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-100/80">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><MapPin className="w-3 h-3" />Endereço de entrega</p>
                      <div className="grid grid-cols-4 gap-2.5">
                        <div className="col-span-3"><label className="block text-[11px] font-semibold text-slate-400 mb-1">Rua *</label><input type="text" value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} className="input-field py-2.5" /></div>
                        <div><label className="block text-[11px] font-semibold text-slate-400 mb-1">Nº *</label><input type="text" value={address.number} onChange={e => setAddress(a => ({ ...a, number: e.target.value }))} className="input-field py-2.5" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div><label className="block text-[11px] font-semibold text-slate-400 mb-1">Complemento</label><input type="text" value={address.complement} onChange={e => setAddress(a => ({ ...a, complement: e.target.value }))} className="input-field py-2.5" /></div>
                        <div><label className="block text-[11px] font-semibold text-slate-400 mb-1">Bairro *</label><input type="text" value={address.neighborhood} onChange={e => setAddress(a => ({ ...a, neighborhood: e.target.value }))} className="input-field py-2.5" /></div>
                      </div>
                      <div className="grid grid-cols-4 gap-2.5">
                        <div className="col-span-2"><label className="block text-[11px] font-semibold text-slate-400 mb-1">Cidade *</label><input type="text" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} className="input-field py-2.5" /></div>
                        <div><label className="block text-[11px] font-semibold text-slate-400 mb-1">UF</label><input type="text" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} className="input-field py-2.5" maxLength={2} /></div>
                        <div><label className="block text-[11px] font-semibold text-slate-400 mb-1">CEP</label><input type="text" value={address.zip} onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))} className="input-field py-2.5" /></div>
                      </div>
                    </div>
                  )}
                  {errorMsg && <div className="bg-red-50/80 text-red-600 text-sm px-4 py-2.5 rounded-xl border border-red-100/80 animate-scale-in">{errorMsg}</div>}
                </div>
              )}

              {/* PAYMENT */}
              {step === 'payment' && (
                <div className="space-y-4">
                  <div className="bg-slate-50/80 rounded-xl p-4 space-y-2 text-[13px] border border-slate-100/80">
                    <div className="flex justify-between"><span className="text-slate-500">Cliente</span><span className="font-medium text-slate-900">{customerName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Telefone</span><span className="font-medium text-slate-900">{customerPhone}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Entrega</span><span className="font-medium text-slate-900">{deliveryType === 'pickup' ? 'Retirada' : 'Delivery'}</span></div>
                    {deliveryType === 'delivery' && address.street && <div className="flex justify-between"><span className="text-slate-500">Endereço</span><span className="font-medium text-slate-900 text-right max-w-[180px] truncate">{formatAddress(address)}</span></div>}
                    <div className="flex justify-between pt-2 border-t border-slate-200/50"><span className="font-semibold text-slate-700">Total</span><span className="font-bold" style={{ color: accent }}>R$ {cartTotal.toFixed(2).replace('.', ',')}</span></div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Forma de pagamento</label>
                    <div className="space-y-1.5">
                      {availablePaymentMethods.map(method => {
                        const cfg = PAYMENT_METHOD_LABELS[method];
                        return (
                          <button key={method} onClick={() => setSelectedPayment(method)} className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${selectedPayment === method ? 'bg-slate-50' : 'border-transparent bg-slate-50/50 hover:bg-slate-50'}`} style={selectedPayment === method ? { borderColor: accent } : undefined}>
                            <span className="text-lg">{cfg.emoji}</span>
                            <span className="text-sm font-semibold flex-1" style={selectedPayment === method ? { color: accent } : undefined}>{cfg.label}</span>
                            {selectedPayment === method && <Check className="w-4 h-4" style={{ color: accent }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {selectedPayment === 'cash' && (
                    <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-100/60">
                      <label className="block text-[11px] font-semibold text-amber-700 mb-1.5 uppercase tracking-wider">Troco para quanto?</label>
                      <input type="text" value={cashChange} onChange={e => setCashChange(e.target.value)} className="input-field py-2.5" placeholder="Ex: R$ 100,00" />
                    </div>
                  )}
                </div>
              )}

              {/* LOADING */}
              {step === 'paying' && (
                <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
                  <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: accent }} />
                  <p className="text-slate-700 font-semibold">Gerando cobrança PIX...</p>
                  <p className="text-sm text-slate-400 mt-1">Aguarde um momento</p>
                </div>
              )}

              {/* PIX */}
              {step === 'pix' && (
                <div className="flex flex-col items-center py-4 animate-scale-in">
                  <div className="bg-white p-5 rounded-2xl shadow-elevated border border-slate-100/50 mb-5">
                    {pixQrCode ? <img src={pixQrCode} alt="QR Code PIX" className="w-52 h-52" /> : <div className="w-52 h-52 flex items-center justify-center"><QrCode className="w-20 h-20 text-slate-200" /></div>}
                  </div>
                  <p className="text-xl font-bold text-slate-900 tracking-tight">R$ {pixAmount.toFixed(2).replace('.', ',')}</p>
                  <p className="text-sm text-slate-500 mb-4">Escaneie ou copie o código PIX</p>
                  <div className="w-full bg-slate-50/80 rounded-xl p-3 mb-3 border border-slate-100/60">
                    <code className="text-[11px] text-slate-600 break-all line-clamp-3 block font-mono">{pixCopyPaste}</code>
                  </div>
                  <button onClick={copyPixCode} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all" style={{ borderColor: accent, color: accent }}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar código PIX'}
                  </button>
                  {polling && <div className="flex items-center gap-2 mt-6 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Aguardando pagamento...</div>}
                </div>
              )}

              {/* SUCCESS */}
              {step === 'success' && (
                <div className="flex flex-col items-center py-10 animate-scale-in">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4"><Check className="w-8 h-8 text-emerald-600" /></div>
                  <h3 className="text-lg font-bold text-slate-900">Pagamento confirmado!</h3>
                  <p className="text-sm text-slate-500 text-center mt-1">Seu pedido foi recebido e está sendo preparado.</p>
                </div>
              )}

              {/* ORDER PLACED */}
              {step === 'order_placed' && (
                <div className="flex flex-col items-center py-10 animate-scale-in">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: accent + '15' }}><Check className="w-8 h-8" style={{ color: accent }} /></div>
                  <h3 className="text-lg font-bold text-slate-900">Pedido realizado!</h3>
                  <p className="text-sm text-slate-500 text-center mt-1">
                    {selectedPayment === 'credit_card' || selectedPayment === 'debit_card' ? 'Pague na retirada com cartão.' : selectedPayment === 'cash' ? `Pague em dinheiro na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.${cashChange ? ` Troco para R$ ${cashChange}.` : ''}` : selectedPayment === 'meal_voucher' ? `Apresente o vale na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.` : 'Seu pedido foi recebido.'}
                  </p>
                </div>
              )}

              {/* ERRORS */}
              {step === 'error' && <div className="flex flex-col items-center py-10 animate-scale-in"><div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4"><X className="w-8 h-8 text-red-500" /></div><h3 className="text-lg font-bold text-slate-900">Erro no pagamento</h3><p className="text-sm text-red-500 text-center mt-1">{errorMsg}</p></div>}
              {step === 'no-xgate' && <div className="flex flex-col items-center py-10 animate-scale-in"><div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4"><QrCode className="w-8 h-8 text-amber-600" /></div><h3 className="text-lg font-bold text-slate-900">PIX indisponível</h3><p className="text-sm text-slate-500 text-center mt-1">Este restaurante ainda não configurou PIX. Escolha outra forma de pagamento.</p></div>}
              {step === 'no-methods' && <div className="flex flex-col items-center py-10 animate-scale-in"><div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4"><QrCode className="w-8 h-8 text-amber-600" /></div><h3 className="text-lg font-bold text-slate-900">Pagamento indisponível</h3><p className="text-sm text-slate-500 text-center mt-1">Nenhuma forma de pagamento configurada.</p></div>}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100/80 space-y-2.5">
              {step === 'cart' && cart.length > 0 && (
                <button onClick={() => { setShowCart(false); setShowCart(true); setStep('delivery'); }} className="btn-primary w-full py-3.5 text-[15px]">Continuar</button>
              )}
              {step === 'delivery' && (
                <>
                  <button onClick={() => { const err = validateDeliveryStep(); if (err) { setErrorMsg(err); return; } setErrorMsg(''); if (availablePaymentMethods.length === 0) { setStep('no-methods'); return; } setStep('payment'); if (availablePaymentMethods.length === 1) setSelectedPayment(availablePaymentMethods[0]); }} className="btn-primary w-full py-3.5 text-[15px]">Escolher pagamento</button>
                  <button onClick={() => setStep('cart')} className="btn-ghost w-full">Voltar</button>
                </>
              )}
              {step === 'payment' && (
                <>
                  <button onClick={handlePlaceOrder} disabled={!selectedPayment} className="btn-primary w-full py-3.5 text-[15px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {selectedPayment === 'pix' && <QrCode className="w-5 h-5" />}
                    {selectedPayment === 'pix' ? `Pagar com PIX — R$ ${cartTotal.toFixed(2).replace('.', ',')}` : `Confirmar — R$ ${cartTotal.toFixed(2).replace('.', ',')}`}
                  </button>
                </>
              )}
              {(step === 'success' || step === 'order_placed' || step === 'error' || step === 'no-xgate' || step === 'no-methods') && (
                <button onClick={closeAndReset} className="btn-ghost w-full">Fechar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-8 text-[11px] text-slate-400 font-medium">Cardápio Digital</div>
    </div>
  );
}
