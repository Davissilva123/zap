import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/db';
import { createPixCharge, checkPixPayment, createOrder, PAYMENT_METHOD_LABELS } from '../lib/xgate';
import type { Category, MenuItem, RestaurantSettings, OrderItem, PaymentMethod, DeliveryAddress } from '../lib/types';
import { MapPin, Phone, ShoppingCart, Plus, Minus, Trash2, X, Copy, Check, Loader2, QrCode, Truck, ShoppingBag, ArrowLeft, ChefHat, Zap } from 'lucide-react';

interface CartItem extends OrderItem { categoryId: string; }
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
  const catBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const data = await db.getPublicMenu(slug);
      if (!data) return;
      setSettings(data.settings);
      setCategories(data.categories);
      setItems(data.items);
      db.addScan(data.settings.userId);
    };
    load();
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
        await createOrder(settings.userId, cart, cartTotal, customerName.trim(), customerPhone.trim(), 'pix', deliveryType, deliveryType === 'delivery' ? address : null, result);
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
    await createOrder(settings.userId, cart, cartTotal, customerName.trim(), customerPhone.trim(), selectedPayment as PaymentMethod, deliveryType, deliveryType === 'delivery' ? address : null, null);
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

  const closeAndReset = () => {
    setCart([]); setShowCart(false); setStep('cart'); setCustomerName(''); setCustomerPhone('');
    setAddress(emptyAddress); setSelectedPayment(''); setDeliveryType('pickup');
    setPixCopyPaste(''); setPixQrCode(''); setPixTxId(''); setCashChange('');
  };

  const formatAddress = (a: DeliveryAddress) => {
    const parts = [a.street, a.number].filter(Boolean);
    if (a.complement) parts.push(`(${a.complement})`);
    parts.push(a.neighborhood, a.city);
    if (a.state) parts.push(a.state);
    return parts.filter(Boolean).join(', ');
  };

  const copyPixCode = () => { navigator.clipboard.writeText(pixCopyPaste); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center px-6">
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

  const visibleCategories = categories.filter(c => items.some(i => i.categoryId === c.id));
  const filteredCategories = activeCat ? visibleCategories.filter(c => c.id === activeCat) : visibleCategories;

  return (
    <div className="min-h-screen bg-white" style={{ '--accent': accent } as React.CSSProperties}>

      {/* Hero */}
      <div className="relative" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 100%)' }} />
        <div className="relative max-w-xl mx-auto px-5 pt-10 pb-16 text-center">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt={settings.name} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 ring-4 ring-white/20 shadow-xl" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 ring-2 ring-white/20">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white tracking-tight">{settings.name}</h1>
          {settings.description && (
            <p className="text-white/75 mt-2 text-sm max-w-xs mx-auto leading-relaxed">{settings.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
            {settings.address && (
              <span className="flex items-center gap-1 text-white/60 text-xs"><MapPin className="w-3 h-3" />{settings.address}</span>
            )}
            {settings.phone && (
              <span className="flex items-center gap-1 text-white/60 text-xs"><Phone className="w-3 h-3" />{settings.phone}</span>
            )}
          </div>
        </div>
      </div>

      {/* Category bar - sticky */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm">
        <div ref={catBarRef} className="max-w-xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveCat('')}
            className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0"
            style={!activeCat ? { backgroundColor: accent, color: '#fff' } : { backgroundColor: '#f1f5f9', color: '#64748b' }}
          >
            Todos
          </button>
          {visibleCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(activeCat === cat.id ? '' : cat.id)}
              className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0"
              style={activeCat === cat.id ? { backgroundColor: accent, color: '#fff' } : { backgroundColor: '#f1f5f9', color: '#64748b' }}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-xl mx-auto pb-32">
        {filteredCategories.map(cat => {
          const catItems = items.filter(i => i.categoryId === cat.id);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.id}>
              <div className="px-5 pt-7 pb-3 flex items-center gap-2">
                <span className="text-xl">{cat.emoji}</span>
                <h2 className="text-base font-bold text-slate-900">{cat.name}</h2>
                <span className="text-xs text-slate-400 font-medium ml-auto">{catItems.length} {catItems.length === 1 ? 'item' : 'itens'}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {catItems.map(item => {
                  const inCart = cart.find(c => c.menuItemId === item.id);
                  return (
                    <div key={item.id} className="flex items-center gap-4 px-5 py-4 active:bg-slate-50 transition-colors">
                      {/* Emoji */}
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ backgroundColor: accent + '12' }}>
                        {item.emoji}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-[15px] leading-snug">{item.name}</h3>
                        {item.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
                        )}
                        <p className="text-sm font-bold mt-1.5" style={{ color: accent }}>
                          R$ {item.price.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      {/* Add / Qty */}
                      <div className="flex-shrink-0">
                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQty(item.id, inCart.quantity - 1)}
                              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:scale-95 transition-transform"
                            >
                              <Minus className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                            <span className="text-sm font-bold w-5 text-center text-slate-900">{inCart.quantity}</span>
                            <button
                              onClick={() => updateQty(item.id, inCart.quantity + 1)}
                              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-md"
                              style={{ backgroundColor: accent }}
                            >
                              <Plus className="w-3.5 h-3.5 text-white" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            className="w-9 h-9 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform"
                            style={{ backgroundColor: accent }}
                          >
                            <Plus className="w-4 h-4 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="text-center py-20 px-6">
            <ChefHat className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Nenhum item disponível</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-[11px] text-slate-300 font-medium flex items-center justify-center gap-1.5">
        <Zap className="w-3 h-3" /> Powered by ZapMenu
      </div>

      {/* Cart FAB */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 max-w-xl mx-auto">
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl text-white active:scale-[0.98] transition-transform"
            style={{ backgroundColor: accent }}
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full text-[10px] font-bold flex items-center justify-center" style={{ color: accent }}>
                {cartCount}
              </span>
            </div>
            <span className="font-bold text-[15px] flex-1 text-left">Ver pedido</span>
            <span className="font-bold text-[15px]">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
          </button>
        </div>
      )}

      {/* Checkout drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (['cart', 'success', 'order_placed'].includes(step)) setShowCart(false); }} />
          <div className="relative ml-auto w-full max-w-md bg-white flex flex-col h-full shadow-2xl">

            {/* Drawer header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              {['delivery', 'payment'].includes(step) && (
                <button onClick={() => setStep(step === 'payment' ? 'delivery' : 'cart')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <ArrowLeft className="w-4 h-4 text-slate-600" />
                </button>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-base">
                  {step === 'cart' && 'Seu pedido'}
                  {step === 'delivery' && 'Dados de entrega'}
                  {step === 'payment' && 'Forma de pagamento'}
                  {step === 'paying' && 'Processando...'}
                  {step === 'pix' && 'Pagar com PIX'}
                  {step === 'success' && 'Pedido confirmado!'}
                  {step === 'order_placed' && 'Pedido realizado!'}
                  {step === 'error' && 'Erro no pagamento'}
                  {step === 'no-xgate' && 'PIX indisponível'}
                  {step === 'no-methods' && 'Pagamento indisponível'}
                </h3>
                {step === 'cart' && <p className="text-xs text-slate-400 mt-0.5">{cartCount} {cartCount === 1 ? 'item' : 'itens'}</p>}
              </div>
              {step === 'cart' && (
                <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              )}
            </div>

            {/* Step indicator */}
            {['cart', 'delivery', 'payment'].includes(step) && (
              <div className="px-5 py-3 flex items-center gap-2">
                {['cart', 'delivery', 'payment'].map((s, i) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                      step === s ? 'text-white shadow-md' : i < ['cart', 'delivery', 'payment'].indexOf(step) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`} style={step === s ? { backgroundColor: accent } : {}}>
                      {i < ['cart', 'delivery', 'payment'].indexOf(step) ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    {i < 2 && <div className={`flex-1 h-0.5 rounded-full transition-all ${i < ['cart', 'delivery', 'payment'].indexOf(step) ? 'bg-emerald-500' : 'bg-slate-100'}`} />}
                  </div>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">

              {/* CART */}
              {step === 'cart' && (
                <div className="px-5 py-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">Seu carrinho está vazio</p>
                    </div>
                  ) : (
                    <div className="space-y-0 divide-y divide-slate-100">
                      {cart.map(item => (
                        <div key={item.menuItemId} className="flex items-center gap-3 py-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: accent + '12' }}>
                            {item.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                            <p className="text-xs text-slate-400">R$ {item.price.toFixed(2).replace('.', ',')} un.</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => updateQty(item.menuItemId, item.quantity - 1)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center active:scale-95">
                              <Minus className="w-3 h-3 text-slate-600" />
                            </button>
                            <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                            <button onClick={() => updateQty(item.menuItemId, item.quantity + 1)} className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95" style={{ backgroundColor: accent }}>
                              <Plus className="w-3 h-3 text-white" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <p className="text-sm font-bold text-slate-900 w-16 text-right">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                            <button onClick={() => removeFromCart(item.menuItemId)} className="w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* DELIVERY */}
              {step === 'delivery' && (
                <div className="px-5 py-4 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Tipo de entrega</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'pickup' as const, label: 'Retirada', icon: ShoppingBag },
                        { value: 'delivery' as const, label: 'Delivery', icon: Truck },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setDeliveryType(opt.value)}
                          className="p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2"
                          style={deliveryType === opt.value ? { borderColor: accent, backgroundColor: accent + '08' } : { borderColor: '#e2e8f0' }}
                        >
                          <opt.icon className="w-5 h-5" style={deliveryType === opt.value ? { color: accent } : { color: '#94a3b8' }} />
                          <span className="text-sm font-semibold" style={deliveryType === opt.value ? { color: accent } : { color: '#64748b' }}>
                            {opt.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Nome *</label>
                      <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="input-field" placeholder="Seu nome" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Telefone *</label>
                      <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="input-field" placeholder="(11) 99999-0000" />
                    </div>
                  </div>

                  {deliveryType === 'delivery' && (
                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> Endereço de entrega
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-3">
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Rua *</label>
                          <input type="text" value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} className="input-field py-2" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Nº *</label>
                          <input type="text" value={address.number} onChange={e => setAddress(a => ({ ...a, number: e.target.value }))} className="input-field py-2" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Complemento</label>
                          <input type="text" value={address.complement} onChange={e => setAddress(a => ({ ...a, complement: e.target.value }))} className="input-field py-2" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Bairro *</label>
                          <input type="text" value={address.neighborhood} onChange={e => setAddress(a => ({ ...a, neighborhood: e.target.value }))} className="input-field py-2" />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Cidade *</label>
                          <input type="text" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} className="input-field py-2" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">UF</label>
                          <input type="text" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} className="input-field py-2" maxLength={2} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">CEP</label>
                          <input type="text" value={address.zip} onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))} className="input-field py-2" />
                        </div>
                      </div>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{errorMsg}</div>
                  )}
                </div>
              )}

              {/* PAYMENT */}
              {step === 'payment' && (
                <div className="px-5 py-4 space-y-5">
                  {/* Order summary */}
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Resumo do pedido</p>
                    {[
                      { label: 'Cliente', value: customerName },
                      { label: 'Telefone', value: customerPhone },
                      { label: 'Entrega', value: deliveryType === 'pickup' ? 'Retirada no local' : 'Delivery' },
                      ...(deliveryType === 'delivery' && address.street ? [{ label: 'Endereço', value: formatAddress(address) }] : []),
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-slate-400">{row.label}</span>
                        <span className="font-medium text-slate-700 text-right max-w-[200px] truncate">{row.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="font-bold text-lg" style={{ color: accent }}>R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Forma de pagamento</p>
                    <div className="space-y-2">
                      {availablePaymentMethods.map(method => {
                        const cfg = PAYMENT_METHOD_LABELS[method];
                        const active = selectedPayment === method;
                        return (
                          <button
                            key={method}
                            onClick={() => setSelectedPayment(method)}
                            className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left"
                            style={active ? { borderColor: accent, backgroundColor: accent + '08' } : { borderColor: '#e2e8f0' }}
                          >
                            <span className="text-xl">{cfg.emoji}</span>
                            <span className="text-sm font-semibold flex-1" style={active ? { color: accent } : { color: '#374151' }}>{cfg.label}</span>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${active ? '' : 'border-slate-200'}`}
                              style={active ? { borderColor: accent, backgroundColor: accent } : {}}>
                              {active && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedPayment === 'cash' && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <label className="block text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Troco para quanto?</label>
                      <input type="text" value={cashChange} onChange={e => setCashChange(e.target.value)} className="input-field" placeholder="Ex: R$ 100,00" />
                    </div>
                  )}
                </div>
              )}

              {/* PAYING */}
              {step === 'paying' && (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: accent + '15' }}>
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
                  </div>
                  <p className="font-bold text-slate-900 text-base">Gerando cobrança PIX...</p>
                  <p className="text-sm text-slate-400 mt-1">Aguarde um momento</p>
                </div>
              )}

              {/* PIX */}
              {step === 'pix' && (
                <div className="flex flex-col items-center px-5 py-6">
                  <div className="p-4 rounded-2xl border-2 border-slate-100 shadow-sm mb-5">
                    {pixQrCode
                      ? <img src={pixQrCode} alt="QR Code PIX" className="w-52 h-52" />
                      : <div className="w-52 h-52 flex items-center justify-center bg-slate-50 rounded-xl"><QrCode className="w-20 h-20 text-slate-200" /></div>
                    }
                  </div>
                  <p className="text-2xl font-bold text-slate-900 tracking-tight">R$ {pixAmount.toFixed(2).replace('.', ',')}</p>
                  <p className="text-sm text-slate-400 mt-1 mb-5">Escaneie o QR Code ou copie o código</p>

                  <div className="w-full bg-slate-50 rounded-2xl p-3.5 mb-3 border border-slate-200">
                    <code className="text-[11px] text-slate-500 break-all line-clamp-3 font-mono block">{pixCopyPaste}</code>
                  </div>
                  <button
                    onClick={copyPixCode}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-semibold text-sm transition-all"
                    style={{ borderColor: accent, color: accent }}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar código PIX'}
                  </button>
                  {polling && (
                    <div className="flex items-center gap-2 mt-6 text-sm text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Aguardando confirmação do pagamento...
                    </div>
                  )}
                </div>
              )}

              {/* SUCCESS */}
              {step === 'success' && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
                    <Check className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Pagamento confirmado!</h3>
                  <p className="text-slate-400 mt-2 text-sm leading-relaxed">Seu pedido foi recebido e está sendo preparado. Obrigado!</p>
                </div>
              )}

              {/* ORDER PLACED */}
              {step === 'order_placed' && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: accent + '15' }}>
                    <Check className="w-10 h-10" style={{ color: accent }} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Pedido realizado!</h3>
                  <p className="text-slate-400 mt-2 text-sm leading-relaxed">
                    {selectedPayment === 'cash'
                      ? `Pague em dinheiro na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.${cashChange ? ` Troco para R$ ${cashChange}.` : ''}`
                      : selectedPayment === 'meal_voucher'
                      ? `Apresente o vale na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.`
                      : `Pague com cartão na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.`}
                  </p>
                </div>
              )}

              {/* ERROR */}
              {step === 'error' && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-5">
                    <X className="w-10 h-10 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Erro no pagamento</h3>
                  <p className="text-red-400 mt-2 text-sm">{errorMsg}</p>
                </div>
              )}

              {/* NO XGATE */}
              {step === 'no-xgate' && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mb-5">
                    <QrCode className="w-10 h-10 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">PIX indisponível</h3>
                  <p className="text-slate-400 mt-2 text-sm">Este restaurante ainda não configurou PIX. Escolha outra forma de pagamento.</p>
                </div>
              )}

              {/* NO METHODS */}
              {step === 'no-methods' && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mb-5">
                    <ShoppingCart className="w-10 h-10 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Pagamento indisponível</h3>
                  <p className="text-slate-400 mt-2 text-sm">Nenhuma forma de pagamento foi configurada.</p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-5 pb-6 pt-4 border-t border-slate-100 space-y-2.5">
              {step === 'cart' && cart.length > 0 && (
                <button
                  onClick={() => setStep('delivery')}
                  className="w-full py-4 rounded-2xl text-white font-bold text-[15px] active:scale-[0.98] transition-transform shadow-lg"
                  style={{ backgroundColor: accent }}
                >
                  Continuar → Entrega
                </button>
              )}
              {step === 'delivery' && (
                <button
                  onClick={() => {
                    const err = validateDeliveryStep();
                    if (err) { setErrorMsg(err); return; }
                    setErrorMsg('');
                    if (availablePaymentMethods.length === 0) { setStep('no-methods'); return; }
                    setStep('payment');
                    if (availablePaymentMethods.length === 1) setSelectedPayment(availablePaymentMethods[0]);
                  }}
                  className="w-full py-4 rounded-2xl text-white font-bold text-[15px] active:scale-[0.98] transition-transform shadow-lg"
                  style={{ backgroundColor: accent }}
                >
                  Continuar → Pagamento
                </button>
              )}
              {step === 'payment' && (
                <button
                  onClick={handlePlaceOrder}
                  disabled={!selectedPayment}
                  className="w-full py-4 rounded-2xl text-white font-bold text-[15px] active:scale-[0.98] transition-transform shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: accent }}
                >
                  {selectedPayment === 'pix' && <QrCode className="w-5 h-5" />}
                  {selectedPayment === 'pix'
                    ? `Gerar PIX — R$ ${cartTotal.toFixed(2).replace('.', ',')}`
                    : `Confirmar pedido — R$ ${cartTotal.toFixed(2).replace('.', ',')}`}
                </button>
              )}
              {['success', 'order_placed', 'error', 'no-xgate', 'no-methods'].includes(step) && (
                <button onClick={closeAndReset} className="w-full py-4 rounded-2xl bg-slate-100 text-slate-700 font-bold text-[15px] active:scale-[0.98] transition-transform">
                  Fechar
                </button>
              )}

              {/* Cart total in footer for cart step */}
              {step === 'cart' && cart.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm text-slate-400">Total do pedido</span>
                  <span className="font-bold text-base" style={{ color: accent }}>R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
