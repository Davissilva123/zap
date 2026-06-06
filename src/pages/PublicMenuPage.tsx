import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { createPixCharge, checkPixPayment, createOrder, PAYMENT_METHOD_LABELS } from '../lib/xgate';
import { useCustomerAuth } from '../lib/customerAuth';
import type { Category, MenuItem, RestaurantSettings, OrderItem, PaymentMethod, DeliveryAddress } from '../lib/types';
import { MapPin, Phone, ShoppingBag, Plus, Minus, Trash2, X, Copy, Check, Loader2, QrCode, Truck, ArrowLeft, ChefHat, Zap, ShoppingCart, User, LogIn, Eye, EyeOff } from 'lucide-react';

interface CartItem extends OrderItem { categoryId: string; }
type CheckoutStep = 'cart' | 'auth' | 'delivery' | 'payment' | 'paying' | 'pix' | 'success' | 'error' | 'no-xgate' | 'no-methods' | 'order_placed';
const emptyAddress: DeliveryAddress = { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip: '' };

export default function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { customer, signIn, signUp } = useCustomerAuth();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Customer auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const data = await db.getPublicMenu(slug);
      setLoading(false);
      if (!data) return;
      setSettings(data.settings);
      setCategories(data.categories);
      setItems(data.items);
      db.addScan(data.settings.userId);
    };
    load();
  }, [slug]);

  // Pre-fill name/phone from customer account
  useEffect(() => {
    if (customer?.user_metadata?.name) setCustomerName(customer.user_metadata.name);
    if (customer?.user_metadata?.phone) setCustomerPhone(customer.user_metadata.phone);
  }, [customer]);

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
        await createOrder(settings.userId, cart, cartTotal, customerName.trim(), customerPhone.trim(), 'pix', deliveryType, deliveryType === 'delivery' ? address : null, result, customer?.id);
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
    setErrorMsg('');
    try {
      await createOrder(settings.userId, cart, cartTotal, customerName.trim(), customerPhone.trim(), selectedPayment as PaymentMethod, deliveryType, deliveryType === 'delivery' ? address : null, null, customer?.id);
      setStep('order_placed');
    } catch (err) {
      setErrorMsg(String(err));
      setStep('error');
    }
  }, [settings, cart, cartTotal, customerName, customerPhone, selectedPayment, deliveryType, address, customer]);

  useEffect(() => {
    if (!polling || !settings?.xgateEmail || !pixTxId) return;
    const interval = setInterval(async () => {
      try {
        const result = await checkPixPayment(settings.xgateEmail!, settings.xgatePassword!, pixTxId);
        if (result.status === 'PAID' || result.status === 'CONCLUIDA' || result.status === 'COMPLETED') {
          setPolling(false); setStep('success');
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

  const handleAuthSubmit = async () => {
    setAuthError('');
    if (!authEmail.trim() || !authPassword.trim()) { setAuthError('Preencha e-mail e senha'); return; }
    if (authMode === 'register' && !authName.trim()) { setAuthError('Informe seu nome'); return; }
    setAuthLoading(true);
    try {
      const result = authMode === 'login'
        ? await signIn(authEmail, authPassword)
        : await signUp(authEmail, authPassword, authName.trim(), authPhone.trim());
      if (result.error) {
        const msgs: Record<string, string> = {
          'Invalid login credentials': 'E-mail ou senha incorretos',
          'User already registered': 'E-mail já cadastrado. Faça login.',
          'Password should be at least 6 characters': 'Senha deve ter pelo menos 6 caracteres',
          'Email not confirmed': 'Confirme seu e-mail antes de entrar',
        };
        setAuthError(msgs[result.error] || result.error);
        return;
      }
      if (authMode === 'register') {
        setAuthError('');
        // Supabase may require email confirmation; inform user
        // But if auto-confirm is on, user is already logged in
        setAuthError('Cadastro realizado! Se solicitado, confirme seu e-mail e então faça login.');
        setAuthMode('login');
        return;
      }
      // Login OK — proceed to delivery
      setStep('delivery');
    } finally {
      setAuthLoading(false);
    }
  };

  const formatAddress = (a: DeliveryAddress) => {
    const parts = [a.street, a.number].filter(Boolean);
    if (a.complement) parts.push(`(${a.complement})`);
    parts.push(a.neighborhood, a.city);
    if (a.state) parts.push(a.state);
    return parts.filter(Boolean).join(', ');
  };

  const copyPixCode = () => { navigator.clipboard.writeText(pixCopyPaste); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <div className="h-52 bg-slate-200 animate-pulse" />
        <div className="max-w-xl mx-auto px-4 pt-5 space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 flex gap-4 animate-pulse">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 bg-slate-100 rounded-full w-3/4" />
                <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                <div className="h-4 bg-slate-100 rounded-full w-1/4 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 rounded-3xl bg-white shadow-sm flex items-center justify-center mx-auto mb-5">
            <ChefHat className="w-9 h-9 text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Cardápio não encontrado</h2>
          <p className="text-slate-400 mt-2 text-sm">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  const accent = settings.accentColor;
  const visibleCategories = categories.filter(c => items.some(i => i.categoryId === c.id));
  const filteredCategories = activeCat ? visibleCategories.filter(c => c.id === activeCat) : visibleCategories;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden" style={{ background: accent }}>
        {/* Cover image */}
        {settings.coverUrl && (
          <>
            <img src={settings.coverUrl} alt="capa" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: `${accent}cc` }} />
          </>
        )}
        {/* decorative circles */}
        {!settings.coverUrl && (
          <>
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20" style={{ background: 'rgba(255,255,255,0.3)' }} />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ background: 'rgba(255,255,255,0.4)' }} />
          </>
        )}

        <div className="relative max-w-xl mx-auto px-5 pt-12 pb-20">
          {/* Customer account button */}
          <div className="absolute top-3 right-5">
            {customer ? (
              <button
                onClick={() => navigate(`/m/${slug}/conta`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold hover:bg-white/30 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                Meus pedidos
              </button>
            ) : (
              <button
                onClick={() => { setShowCart(true); setStep('auth'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold hover:bg-white/30 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Entrar
              </button>
            )}
          </div>

          <div className="flex items-center gap-5">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.name} className="w-20 h-20 rounded-2xl object-cover shadow-xl ring-4 ring-white/25 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 ring-2 ring-white/20">
                <ChefHat className="w-9 h-9 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold text-white leading-tight tracking-tight">{settings.name}</h1>
              {settings.description && (
                <p className="text-white/70 mt-1 text-sm leading-relaxed line-clamp-2">{settings.description}</p>
              )}
            </div>
          </div>

          {(settings.address || settings.phone) && (
            <div className="flex flex-wrap gap-2 mt-5">
              {settings.address && (
                <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <MapPin className="w-3 h-3 text-white/80" />
                  <span className="text-white/80 text-xs font-medium truncate max-w-[180px]">{settings.address}</span>
                </div>
              )}
              {settings.phone && (
                <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <Phone className="w-3 h-3 text-white/80" />
                  <span className="text-white/80 text-xs font-medium">{settings.phone}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CATEGORY BAR ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-black/5 shadow-sm">
        <div ref={catBarRef} className="max-w-xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setActiveCat('')}
            className="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 border"
            style={!activeCat
              ? { backgroundColor: accent, color: '#fff', borderColor: accent }
              : { backgroundColor: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }}
          >
            Todos
          </button>
          {visibleCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(activeCat === cat.id ? '' : cat.id)}
              className="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 border flex items-center gap-1.5"
              style={activeCat === cat.id
                ? { backgroundColor: accent, color: '#fff', borderColor: accent }
                : { backgroundColor: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }}
            >
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── MENU ITEMS ── */}
      <div className="max-w-xl mx-auto px-4 pb-36 pt-2">
        {filteredCategories.map(cat => {
          const catItems = items.filter(i => i.categoryId === cat.id);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.id} className="mt-6">
              {/* Category header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-2xl">{cat.emoji}</span>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{cat.name}</h2>
              </div>

              {/* Items */}
              <div className="space-y-3">
                {catItems.map(item => {
                  const inCart = cart.find(c => c.menuItemId === item.id);
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-black/5 flex items-stretch"
                    >
                      {/* Left color bar */}
                      <div className="w-1 flex-shrink-0" style={{ backgroundColor: inCart ? accent : 'transparent' }} />

                      <div className="flex items-center gap-4 px-4 py-4 flex-1 min-w-0">
                        {/* Image or Emoji */}
                        <div className="w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center text-3xl transition-transform duration-200"
                              style={{ backgroundColor: accent + '15' }}
                            >
                              {item.emoji}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 text-[15px] leading-snug">{item.name}</h3>
                          {item.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
                          )}
                          <p className="text-base font-extrabold mt-2 tracking-tight" style={{ color: accent }}>
                            R$ {item.price.toFixed(2).replace('.', ',')}
                          </p>
                        </div>

                        {/* Add / Qty */}
                        <div className="flex-shrink-0">
                          {inCart ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateQty(item.id, inCart.quantity - 1)}
                                className="w-8 h-8 rounded-full border-2 flex items-center justify-center active:scale-90 transition-transform"
                                style={{ borderColor: accent }}
                              >
                                <Minus className="w-3.5 h-3.5" style={{ color: accent }} />
                              </button>
                              <span className="text-sm font-extrabold w-6 text-center" style={{ color: accent }}>{inCart.quantity}</span>
                              <button
                                onClick={() => updateQty(item.id, inCart.quantity + 1)}
                                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm"
                                style={{ backgroundColor: accent }}
                              >
                                <Plus className="w-3.5 h-3.5 text-white" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-md"
                              style={{ backgroundColor: accent }}
                            >
                              <Plus className="w-4.5 h-4.5 text-white" />
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

        {filteredCategories.length === 0 && (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-3xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-9 h-9 text-slate-200" />
            </div>
            <p className="text-slate-400 font-medium">Nenhum item disponível</p>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="text-center pb-8 text-[11px] text-slate-300 font-semibold flex items-center justify-center gap-1.5 tracking-wide uppercase">
        <Zap className="w-3 h-3" /> Powered by ZapMenu
      </div>

      {/* ── CART FAB ── */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-6 left-0 right-0 z-40 px-5 max-w-xl mx-auto">
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-white active:scale-[0.97] transition-all duration-150 shadow-2xl"
            style={{ backgroundColor: accent }}
          >
            <div className="relative flex-shrink-0">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white rounded-full text-[10px] font-extrabold flex items-center justify-center shadow" style={{ color: accent }}>
                {cartCount}
              </span>
            </div>
            <span className="font-bold text-[15px] flex-1 text-left">Ver meu pedido</span>
            <span className="font-extrabold text-base">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
          </button>
        </div>
      )}

      {/* ── CHECKOUT MODAL ── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (['cart', 'success', 'order_placed'].includes(step)) setShowCart(false); }}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-white flex flex-col shadow-2xl rounded-t-3xl sm:rounded-3xl"
            style={{ maxHeight: '92dvh' }}>

            {/* Handle bar (mobile) */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-3 pb-4 flex-shrink-0">
              {['auth', 'delivery', 'payment'].includes(step) && (
                <button
                  onClick={() => setStep(step === 'payment' ? 'delivery' : step === 'delivery' ? (customer ? 'cart' : 'auth') : 'cart')}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-600" />
                </button>
              )}
              <div className="flex-1">
                <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                  {step === 'cart' && 'Meu Pedido'}
                  {step === 'auth' && 'Entre ou Cadastre-se'}
                  {step === 'delivery' && 'Informações'}
                  {step === 'payment' && 'Pagamento'}
                  {step === 'paying' && 'Aguarde...'}
                  {step === 'pix' && 'Pagar com PIX'}
                  {step === 'success' && 'Pago! ✓'}
                  {step === 'order_placed' && 'Pedido feito! ✓'}
                  {step === 'error' && 'Ops!'}
                  {step === 'no-xgate' && 'PIX indisponível'}
                  {step === 'no-methods' && 'Indisponível'}
                </h3>
                {step === 'cart' && cartCount > 0 && (
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{cartCount} {cartCount === 1 ? 'item' : 'itens'} selecionados</p>
                )}
              </div>
              {(['cart', 'auth'].includes(step) || ['success', 'order_placed', 'error', 'no-xgate', 'no-methods'].includes(step)) && (
                <button
                  onClick={() => ['success', 'order_placed', 'error', 'no-xgate', 'no-methods'].includes(step) ? closeAndReset() : setShowCart(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </div>

            {/* Step progress */}
            {['cart', 'auth', 'delivery', 'payment'].includes(step) && (
              <div className="px-5 pb-4 flex-shrink-0">
                <div className="flex items-center gap-0">
                  {(['cart', 'auth', 'delivery', 'payment'] as const).map((s, i) => {
                    const allSteps = ['cart', 'auth', 'delivery', 'payment'];
                    const idx = allSteps.indexOf(step);
                    const done = i < idx;
                    const active = step === s;
                    return (
                      <div key={s} className="flex items-center flex-1 last:flex-none">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-all duration-300"
                          style={active
                            ? { backgroundColor: accent, color: '#fff' }
                            : done
                            ? { backgroundColor: accent + '30', color: accent }
                            : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}
                        >
                          {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        {i < 2 && (
                          <div
                            className="flex-1 h-0.5 mx-1 rounded-full transition-all duration-300"
                            style={{ backgroundColor: done ? accent + '50' : '#e2e8f0' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1.5 px-0.5">
                  {['Pedido', 'Conta', 'Dados', 'Pgto'].map((l, i) => {
                    const idx = ['cart', 'auth', 'delivery', 'payment'].indexOf(step);
                    return <span key={l} className="text-[10px] font-semibold" style={{ color: i <= idx ? accent : '#cbd5e1' }}>{l}</span>;
                  })}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-slate-100 mx-5 flex-shrink-0" />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">

              {/* ── STEP: CART ── */}
              {step === 'cart' && (
                <div className="px-5 py-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                        <ShoppingCart className="w-7 h-7 text-slate-200" />
                      </div>
                      <p className="text-slate-400 font-medium text-sm">Seu carrinho está vazio</p>
                      <button onClick={() => setShowCart(false)} className="mt-3 text-sm font-semibold" style={{ color: accent }}>
                        Ver o cardápio
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 -mx-5">
                      {cart.map(item => (
                        <div key={item.menuItemId} className="flex items-center gap-3 px-5 py-3.5">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: accent + '15' }}>
                            {item.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                            <p className="text-xs text-slate-400 font-medium">R$ {item.price.toFixed(2).replace('.', ',')} un.</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                              className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center active:scale-90">
                              {item.quantity === 1 ? <Trash2 className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-slate-600" />}
                            </button>
                            <span className="text-sm font-extrabold w-5 text-center text-slate-900">{item.quantity}</span>
                            <button onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                              className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90"
                              style={{ backgroundColor: accent }}>
                              <Plus className="w-3 h-3 text-white" />
                            </button>
                          </div>
                          <p className="text-sm font-extrabold text-slate-900 w-16 text-right flex-shrink-0">
                            R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP: AUTH ── */}
              {step === 'auth' && (
                <div className="px-5 py-5 space-y-5">
                  {/* Already logged in banner */}
                  {customer ? (
                    <div className="flex flex-col items-center py-6 text-center gap-3">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: accent + '20' }}>
                        <User className="w-7 h-7" style={{ color: accent }} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{customer.user_metadata?.name || customer.email}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{customer.email}</p>
                      </div>
                      <p className="text-sm text-slate-500">Você já está conectado. Clique em continuar.</p>
                    </div>
                  ) : (
                    <>
                      {/* Login / Register tabs */}
                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl">
                        {(['login', 'register'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => { setAuthMode(mode); setAuthError(''); }}
                            className="py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
                            style={authMode === mode
                              ? { backgroundColor: '#fff', color: accent, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                              : { color: '#94a3b8' }}
                          >
                            {mode === 'login' ? 'Entrar' : 'Cadastrar'}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-3">
                        {authMode === 'register' && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nome *</label>
                              <input
                                type="text" value={authName} onChange={e => setAuthName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 placeholder:text-slate-300 focus:outline-none focus:border-slate-400"
                                placeholder="Seu nome completo"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Telefone</label>
                              <input
                                type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 placeholder:text-slate-300 focus:outline-none focus:border-slate-400"
                                placeholder="(11) 99999-0000"
                              />
                            </div>
                          </>
                        )}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">E-mail *</label>
                          <input
                            type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 placeholder:text-slate-300 focus:outline-none focus:border-slate-400"
                            placeholder="seu@email.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Senha *</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 pr-10"
                              placeholder={authMode === 'register' ? 'Mín. 6 caracteres' : '••••••••'}
                              onKeyDown={e => { if (e.key === 'Enter') handleAuthSubmit(); }}
                            />
                            <button
                              type="button" onClick={() => setShowPassword(s => !s)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {authError && (
                        <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 font-medium">
                          <X className="w-4 h-4 flex-shrink-0 mt-0.5" /> {authError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── STEP: DELIVERY ── */}
              {step === 'delivery' && (
                <div className="px-5 py-5 space-y-5">
                  {/* Pickup / Delivery toggle */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                    {([
                      { value: 'pickup' as const, label: 'Retirada', icon: ShoppingBag },
                      { value: 'delivery' as const, label: 'Delivery', icon: Truck },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDeliveryType(opt.value)}
                        className="py-3 rounded-xl flex flex-col items-center gap-1.5 transition-all duration-200 text-sm font-bold"
                        style={deliveryType === opt.value
                          ? { backgroundColor: '#fff', color: accent, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                          : { color: '#94a3b8' }}
                      >
                        <opt.icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Name + Phone */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nome completo *</label>
                      <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 bg-slate-50 transition-colors"
                        placeholder="Seu nome" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">WhatsApp / Telefone *</label>
                      <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 bg-slate-50 transition-colors"
                        placeholder="(11) 99999-0000" />
                    </div>
                  </div>

                  {/* Address fields */}
                  {deliveryType === 'delivery' && (
                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Endereço de entrega</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <input type="text" value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))}
                          className="col-span-3 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white placeholder:text-slate-300 focus:outline-none focus:border-slate-300"
                          placeholder="Rua / Av. *" />
                        <input type="text" value={address.number} onChange={e => setAddress(a => ({ ...a, number: e.target.value }))}
                          className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white placeholder:text-slate-300 focus:outline-none focus:border-slate-300"
                          placeholder="Nº *" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={address.complement} onChange={e => setAddress(a => ({ ...a, complement: e.target.value }))}
                          className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white placeholder:text-slate-300 focus:outline-none focus:border-slate-300"
                          placeholder="Complemento" />
                        <input type="text" value={address.neighborhood} onChange={e => setAddress(a => ({ ...a, neighborhood: e.target.value }))}
                          className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white placeholder:text-slate-300 focus:outline-none focus:border-slate-300"
                          placeholder="Bairro *" />
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        <input type="text" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                          className="col-span-3 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white placeholder:text-slate-300 focus:outline-none focus:border-slate-300"
                          placeholder="Cidade *" />
                        <input type="text" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))}
                          className="col-span-1 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white placeholder:text-slate-300 focus:outline-none focus:border-slate-300"
                          placeholder="UF" maxLength={2} />
                        <input type="text" value={address.zip} onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))}
                          className="col-span-1 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white placeholder:text-slate-300 focus:outline-none focus:border-slate-300 hidden sm:block"
                          placeholder="CEP" />
                      </div>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 font-medium">
                      <X className="w-4 h-4 flex-shrink-0" /> {errorMsg}
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP: PAYMENT ── */}
              {step === 'payment' && (
                <div className="px-5 py-5 space-y-5">
                  {/* Summary card */}
                  <div className="rounded-2xl overflow-hidden border border-slate-100">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resumo</p>
                    </div>
                    <div className="px-4 py-3 space-y-2.5 bg-white">
                      {[
                        { label: 'Cliente', value: customerName },
                        { label: 'Telefone', value: customerPhone },
                        { label: 'Entrega', value: deliveryType === 'pickup' ? '🏠 Retirada no local' : '🛵 Delivery' },
                        ...(deliveryType === 'delivery' && address.street ? [{ label: 'Endereço', value: formatAddress(address) }] : []),
                      ].map(row => (
                        <div key={row.label} className="flex justify-between items-start gap-3 text-sm">
                          <span className="text-slate-400 flex-shrink-0 font-medium">{row.label}</span>
                          <span className="font-semibold text-slate-700 text-right">{row.value}</span>
                        </div>
                      ))}
                      <div className="pt-2.5 mt-1 border-t border-slate-100 flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-sm">Total a pagar</span>
                        <span className="text-xl font-extrabold tracking-tight" style={{ color: accent }}>
                          R$ {cartTotal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment methods */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Como deseja pagar?</p>
                    <div className="space-y-2">
                      {availablePaymentMethods.map(method => {
                        const cfg = PAYMENT_METHOD_LABELS[method];
                        const active = selectedPayment === method;
                        return (
                          <button
                            key={method}
                            onClick={() => setSelectedPayment(method)}
                            className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left"
                            style={active
                              ? { borderColor: accent, backgroundColor: accent + '08' }
                              : { borderColor: '#f1f5f9', backgroundColor: '#f8fafc' }}
                          >
                            <span className="text-2xl w-8 text-center">{cfg.emoji}</span>
                            <span className="text-sm font-bold flex-1" style={active ? { color: accent } : { color: '#374151' }}>
                              {cfg.label}
                            </span>
                            <div
                              className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                              style={active
                                ? { borderColor: accent, backgroundColor: accent }
                                : { borderColor: '#e2e8f0' }}
                            >
                              {active && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedPayment === 'cash' && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                      <label className="block text-xs font-bold text-amber-700 mb-2 uppercase tracking-wider">Troco para quanto?</label>
                      <input type="text" value={cashChange} onChange={e => setCashChange(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-white text-sm font-medium placeholder:text-amber-300 focus:outline-none"
                        placeholder="Ex: R$ 50,00 (deixe vazio se não precisar)" />
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP: PAYING ── */}
              {step === 'paying' && (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ backgroundColor: accent + '15' }}>
                    <Loader2 className="w-9 h-9 animate-spin" style={{ color: accent }} />
                  </div>
                  <p className="font-extrabold text-slate-900 text-xl">Gerando PIX...</p>
                  <p className="text-slate-400 mt-2 text-sm">Só um momento</p>
                </div>
              )}

              {/* ── STEP: PIX ── */}
              {step === 'pix' && (
                <div className="flex flex-col items-center px-5 py-6">
                  <div className="p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-sm mb-4">
                    {pixQrCode
                      ? <img src={pixQrCode} alt="QR Code PIX" className="w-52 h-52" />
                      : <div className="w-52 h-52 flex items-center justify-center rounded-xl bg-slate-50"><QrCode className="w-24 h-24 text-slate-200" /></div>
                    }
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 tracking-tight">R$ {pixAmount.toFixed(2).replace('.', ',')}</p>
                  <p className="text-sm text-slate-400 mt-1 mb-5 font-medium">Escaneie ou copie o código PIX</p>

                  <div className="w-full bg-slate-50 rounded-2xl p-4 mb-3 border border-slate-200">
                    <code className="text-[11px] text-slate-500 break-all line-clamp-3 font-mono leading-relaxed">{pixCopyPaste}</code>
                  </div>

                  <button
                    onClick={copyPixCode}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all duration-200"
                    style={copied
                      ? { backgroundColor: '#10b981', color: '#fff' }
                      : { backgroundColor: accent, color: '#fff' }}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Código copiado!' : 'Copiar código PIX'}
                  </button>

                  {polling && (
                    <div className="flex items-center gap-2 mt-5 text-sm text-slate-400 font-medium">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Aguardando pagamento...
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP: SUCCESS ── */}
              {step === 'success' && (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30">
                    <Check className="w-12 h-12 text-white" strokeWidth={3} />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">Pago!</h3>
                  <p className="text-slate-400 mt-2 leading-relaxed">Seu pedido foi confirmado e está sendo preparado. Obrigado!</p>
                  {customer && (
                    <button
                      onClick={() => { closeAndReset(); navigate(`/m/${slug}/conta`); }}
                      className="mt-5 px-5 py-2.5 rounded-2xl text-sm font-bold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      Acompanhar pedido
                    </button>
                  )}
                </div>
              )}

              {/* ── STEP: ORDER PLACED ── */}
              {step === 'order_placed' && (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg" style={{ backgroundColor: accent, boxShadow: `0 10px 40px ${accent}40` }}>
                    <Check className="w-12 h-12 text-white" strokeWidth={3} />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">Pedido feito!</h3>
                  <p className="text-slate-400 mt-2 leading-relaxed text-sm">
                    {selectedPayment === 'cash'
                      ? `Pague em dinheiro na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.${cashChange ? ` Troco para R$ ${cashChange}.` : ''}`
                      : selectedPayment === 'meal_voucher'
                      ? `Apresente o vale-refeição na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.`
                      : `Pague com cartão na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.`}
                  </p>
                  {customer && (
                    <button
                      onClick={() => { closeAndReset(); navigate(`/m/${slug}/conta`); }}
                      className="mt-5 px-5 py-2.5 rounded-2xl text-sm font-bold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      Acompanhar pedido
                    </button>
                  )}
                </div>
              )}

              {/* ── STEP: ERROR ── */}
              {step === 'error' && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center mb-6 shadow-lg shadow-red-500/30">
                    <X className="w-12 h-12 text-white" strokeWidth={3} />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">Erro ao processar pedido</h3>
                  <p className="text-red-400 mt-2 text-sm">{errorMsg}</p>
                </div>
              )}

              {/* ── STEP: NO XGATE ── */}
              {step === 'no-xgate' && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-24 h-24 rounded-full bg-amber-400 flex items-center justify-center mb-6 shadow-lg shadow-amber-400/30">
                    <QrCode className="w-11 h-11 text-white" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">PIX indisponível</h3>
                  <p className="text-slate-400 mt-2 text-sm">O restaurante ainda não configurou o PIX. Escolha outra forma de pagamento.</p>
                </div>
              )}

              {/* ── STEP: NO METHODS ── */}
              {step === 'no-methods' && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center mb-6">
                    <ShoppingCart className="w-11 h-11 text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">Sem pagamentos</h3>
                  <p className="text-slate-400 mt-2 text-sm">Nenhuma forma de pagamento foi configurada.</p>
                </div>
              )}
            </div>

            {/* ── FOOTER ACTIONS ── */}
            <div className="px-5 pt-4 pb-6 flex-shrink-0 space-y-3 border-t border-slate-100">

              {step === 'cart' && cart.length > 0 && (
                <>
                  <div className="flex justify-between items-center px-1 pb-1">
                    <span className="text-sm text-slate-400 font-medium">Total</span>
                    <span className="text-lg font-extrabold tracking-tight" style={{ color: accent }}>
                      R$ {cartTotal.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <button
                    onClick={() => setStep(customer ? 'delivery' : 'auth')}
                    className="w-full py-4 rounded-2xl text-white font-extrabold text-base active:scale-[0.98] transition-transform shadow-lg"
                    style={{ backgroundColor: accent, boxShadow: `0 8px 24px ${accent}40` }}
                  >
                    Continuar
                  </button>
                </>
              )}

              {step === 'auth' && (
                customer ? (
                  <button
                    onClick={() => setStep('delivery')}
                    className="w-full py-4 rounded-2xl text-white font-extrabold text-base active:scale-[0.98] transition-transform shadow-lg"
                    style={{ backgroundColor: accent, boxShadow: `0 8px 24px ${accent}40` }}
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    onClick={handleAuthSubmit}
                    disabled={authLoading}
                    className="w-full py-4 rounded-2xl text-white font-extrabold text-base active:scale-[0.98] transition-transform shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ backgroundColor: accent, boxShadow: `0 8px 24px ${accent}40` }}
                  >
                    {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    {authLoading ? 'Aguarde...' : authMode === 'login' ? 'Entrar' : 'Criar conta'}
                  </button>
                )
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
                  className="w-full py-4 rounded-2xl text-white font-extrabold text-base active:scale-[0.98] transition-transform shadow-lg"
                  style={{ backgroundColor: accent, boxShadow: `0 8px 24px ${accent}40` }}
                >
                  Continuar
                </button>
              )}

              {step === 'payment' && (
                <button
                  onClick={handlePlaceOrder}
                  disabled={!selectedPayment}
                  className="w-full py-4 rounded-2xl text-white font-extrabold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                  style={selectedPayment ? { backgroundColor: accent, boxShadow: `0 8px 24px ${accent}40` } : { backgroundColor: '#94a3b8' }}
                >
                  {selectedPayment === 'pix' ? <QrCode className="w-5 h-5" /> : null}
                  {!selectedPayment
                    ? 'Selecione uma forma de pagamento'
                    : selectedPayment === 'pix'
                    ? `Gerar PIX — R$ ${cartTotal.toFixed(2).replace('.', ',')}`
                    : `Confirmar pedido — R$ ${cartTotal.toFixed(2).replace('.', ',')}`}
                </button>
              )}

              {['success', 'order_placed', 'error', 'no-xgate', 'no-methods'].includes(step) && (
                <button
                  onClick={closeAndReset}
                  className="w-full py-4 rounded-2xl bg-slate-100 text-slate-700 font-bold text-base active:scale-[0.98] transition-transform"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
