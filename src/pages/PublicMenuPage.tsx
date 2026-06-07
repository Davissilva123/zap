import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../lib/db';
import { createPixCharge, checkPixPayment, createOrder, PAYMENT_METHOD_LABELS } from '../lib/xgate';
import { useCustomerAuth } from '../lib/customerAuth';
import type { Category, MenuItem, RestaurantSettings, OrderItem, PaymentMethod, DeliveryAddress, ItemGroup, SelectedOption } from '../lib/types';
import { MapPin, Phone, ShoppingBag, Plus, Minus, Trash2, X, Copy, Check, Loader2, QrCode, Truck, ArrowLeft, ChefHat, Zap, ShoppingCart, User, LogIn, Eye, EyeOff, Clock, Star, Tag, LayoutGrid, Gift, Search } from 'lucide-react';

interface CartItem extends OrderItem { categoryId: string; }
type CheckoutStep = 'cart' | 'auth' | 'delivery' | 'payment' | 'paying' | 'pix' | 'success' | 'error' | 'no-xgate' | 'no-methods' | 'order_placed';
const emptyAddress: DeliveryAddress = { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip: '' };


function isRestaurantOpen(settings: RestaurantSettings): boolean {
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

export default function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const mesaParam = searchParams.get('mesa'); // table mode
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
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery' | 'table'>(mesaParam ? 'table' : 'pickup');
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

  // Adicionais
  const [itemModal, setItemModal] = useState<{ item: MenuItem; groups: ItemGroup[] } | null>(null);
  const [itemModalQty, setItemModalQty] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, SelectedOption>>({});
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Taxa de entrega
  const [deliveryFee, setDeliveryFee] = useState(0);

  // Cupons
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMsg, setCouponMsg] = useState('');
  const [couponValid, setCouponValid] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCouponId, setAppliedCouponId] = useState<string | null>(null);
  const [appliedCouponUses, setAppliedCouponUses] = useState(0);

  // Busca no cardápio
  const [menuSearch, setMenuSearch] = useState('');

  // Observações do pedido
  const [orderNotes, setOrderNotes] = useState('');

  // Agendamento
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');

  // Fidelidade
  const [loyaltyCount, setLoyaltyCount] = useState<number | null>(null);

  // Avaliação
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [orderRating, setOrderRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

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
      // Repetir pedido: check sessionStorage for pre-filled cart
      const repeatRaw = sessionStorage.getItem(`repeat_cart_${slug}`);
      if (repeatRaw) {
        sessionStorage.removeItem(`repeat_cart_${slug}`);
        try {
          const repeatItems = JSON.parse(repeatRaw) as import('../lib/types').OrderItem[];
          setCart(repeatItems.map(i => ({ ...i, categoryId: data.items.find(m => m.id === i.menuItemId || m.name === i.name)?.categoryId || '' })));
          setShowCart(true);
        } catch { /* ignore parse errors */ }
      }
    };
    load();
  }, [slug]);

  // Pre-fill name/phone from customer account
  useEffect(() => {
    if (customer?.user_metadata?.name) setCustomerName(customer.user_metadata.name);
    if (customer?.user_metadata?.phone) setCustomerPhone(customer.user_metadata.phone);
  }, [customer]);

  const cartSubtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartTotal = cartSubtotal + (deliveryType === 'delivery' ? deliveryFee : 0) - couponDiscount;
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const availablePaymentMethods = settings?.paymentMethods?.filter(m => m) || [];

  const openItemModal = async (item: MenuItem) => {
    setLoadingGroups(true);
    setItemModal(null);
    setItemModalQty(1);
    setSelectedOptions({});
    const groups = await db.getItemGroupsForItems([item.id]);
    setItemModal({ item, groups });
    setLoadingGroups(false);
  };

  const addToCart = (item: MenuItem, qty = 1, opts: SelectedOption[] = []) => {
    const optPrice = opts.reduce((s, o) => s + o.priceDelta, 0);
    const unitPrice = item.price + optPrice;
    const key = item.id + (opts.length ? '_' + opts.map(o => o.optionId).join(',') : '');
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === key);
      if (existing && !opts.length) return prev.map(c => c.menuItemId === key ? { ...c, quantity: c.quantity + qty } : c);
      return [...prev, { menuItemId: key, name: item.name, emoji: item.emoji, price: unitPrice, quantity: qty, categoryId: item.categoryId, selectedOptions: opts.length ? opts : undefined }];
    });
  };

  const confirmItemModal = () => {
    if (!itemModal) return;
    const opts = Object.values(selectedOptions);
    const missing = itemModal.groups.find(g => g.required && !opts.find(o => o.groupId === g.id));
    if (missing) { alert(`Selecione uma opção em "${missing.name}"`); return; }
    addToCart(itemModal.item, itemModalQty, opts);
    setItemModal(null);
  };

  const removeFromCart = (menuItemId: string) => setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
  const updateQty = (menuItemId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(menuItemId);
    setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: qty } : c));
  };

  const applyCoupon = async () => {
    if (!settings || !couponCode.trim()) return;
    setCouponLoading(true);
    setCouponMsg('');
    const result = await db.validateCoupon(settings.userId, couponCode, cartSubtotal);
    setCouponLoading(false);
    if (result.valid && result.coupon) {
      setCouponValid(true);
      setCouponDiscount(result.discount);
      setAppliedCouponId(result.coupon.id);
      setAppliedCouponUses(result.coupon.usesCount);
      setCouponMsg(`✓ Cupom aplicado! Desconto de R$ ${result.discount.toFixed(2).replace('.', ',')}`);
    } else {
      setCouponValid(false);
      setCouponDiscount(0);
      setAppliedCouponId(null);
      setCouponMsg(result.message || 'Cupom inválido');
    }
  };

  const removeCoupon = () => {
    setCouponCode('');
    setCouponValid(false);
    setCouponDiscount(0);
    setAppliedCouponId(null);
    setCouponMsg('');
  };

  const handleNeighborhoodChange = (neighborhood: string) => {
    setAddress(a => ({ ...a, neighborhood }));
    if (!settings) return;
    const match = settings.deliveryNeighborhoods?.find(n => n.name === neighborhood);
    setDeliveryFee(match ? match.fee : (settings.deliveryFee || 0));
  };

  const validateDeliveryStep = () => {
    if (!customerName.trim()) return 'Nome é obrigatório';
    if (!customerPhone.trim()) return 'Telefone é obrigatório';
    if (deliveryType === 'delivery') {
      const minOrder = settings?.minimumOrder ?? 0;
      const cartNet = cartTotal - (couponValid ? couponDiscount : 0);
      if (minOrder > 0 && cartNet < minOrder) {
        return `Pedido mínimo para delivery: R$ ${minOrder.toFixed(2).replace('.', ',')}`;
      }
      if (!address.street.trim()) return 'Rua é obrigatória';
      if (!address.number.trim()) return 'Número é obrigatório';
      if (!address.neighborhood.trim()) return 'Bairro é obrigatório';
      if (!address.city.trim()) return 'Cidade é obrigatória';
    }
    return null;
  };

  const handlePlaceOrder = useCallback(async () => {
    if (!settings) return;
    const delivAddr = deliveryType === 'delivery' ? address : null;
    const tableName = deliveryType === 'table' ? (mesaParam ?? undefined) : undefined;
    const couponCodeToSend = couponValid ? couponCode : undefined;
    const discountToSend = couponValid ? couponDiscount : 0;

    const schedFor = scheduleEnabled && scheduledFor ? new Date(scheduledFor).toISOString() : null;

    const fetchLoyalty = async (orderId: string) => {
      if (settings.loyaltyEnabled && customer?.id) {
        const count = await db.getCustomerOrderCount(settings.userId, customer.id);
        setLoyaltyCount(count);
      }
    };

    if (selectedPayment === 'pix') {
      if (!settings.xgateEmail || !settings.xgatePassword) { setStep('no-xgate'); return; }
      setStep('paying');
      setErrorMsg('');
      try {
        const txId = `cardapio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const result = await createPixCharge(settings.xgateEmail, settings.xgatePassword, cartTotal, txId, customerName.trim());
        const order = await createOrder(settings.userId, cart, cartTotal, customerName.trim(), customerPhone.trim(), 'pix', deliveryType, delivAddr, result, customer?.id, couponCodeToSend, discountToSend, tableName, schedFor, orderNotes || undefined);
        setPlacedOrderId(order.id);
        if (appliedCouponId) await db.useCoupon(appliedCouponId, appliedCouponUses);
        await fetchLoyalty(order.id);
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
      const order = await createOrder(settings.userId, cart, cartTotal, customerName.trim(), customerPhone.trim(), selectedPayment as PaymentMethod, deliveryType, delivAddr, null, customer?.id, couponCodeToSend, discountToSend, tableName, schedFor, orderNotes || undefined);
      setPlacedOrderId(order.id);
      if (appliedCouponId) await db.useCoupon(appliedCouponId, appliedCouponUses);
      await fetchLoyalty(order.id);
      setStep('order_placed');
    } catch (err) {
      setErrorMsg(String(err));
      setStep('error');
    }
  }, [settings, cart, cartTotal, customerName, customerPhone, selectedPayment, deliveryType, address, customer, mesaParam, couponValid, couponCode, couponDiscount, appliedCouponId, appliedCouponUses, scheduleEnabled, scheduledFor, orderNotes]);

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
    setAddress(emptyAddress); setSelectedPayment(''); setDeliveryType(mesaParam ? 'table' : 'pickup');
    setPixCopyPaste(''); setPixQrCode(''); setPixTxId(''); setCashChange('');
    setCouponCode(''); setCouponValid(false); setCouponDiscount(0); setAppliedCouponId(null); setCouponMsg('');
    setPlacedOrderId(null); setOrderRating(0); setRatingComment(''); setRatingSubmitted(false);
    setScheduleEnabled(false); setScheduledFor(''); setLoyaltyCount(null); setOrderNotes('');
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
  const searchQuery = menuSearch.trim().toLowerCase();
  const searchResults = searchQuery
    ? items.filter(i => i.name.toLowerCase().includes(searchQuery) || i.description?.toLowerCase().includes(searchQuery))
    : null;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">

      {/* ── HERO ── */}
      {settings.coverUrl ? (
        /* ── WITH COVER IMAGE — logo + nome DENTRO da capa, sem overlap externo ── */
        <>
          <div className="relative overflow-hidden" style={{ height: 280 }}>
            <img src={settings.coverUrl} alt="capa" className="w-full h-full object-cover" />

            {/* Gradiente forte no bottom para legibilidade */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5" />

            {/* Botão conta — top right */}
            <div className="absolute top-5 right-5">
              {customer ? (
                <button onClick={() => navigate(`/m/${slug}/conta`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-semibold border border-white/20 shadow">
                  <User className="w-3.5 h-3.5" /> Meus pedidos
                </button>
              ) : (
                <button onClick={() => { setShowCart(true); setStep('auth'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-semibold border border-white/20 shadow">
                  <LogIn className="w-3.5 h-3.5" /> Entrar
                </button>
              )}
            </div>

            {/* Logo + nome no rodapé da capa */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
              <div className="max-w-xl mx-auto flex items-end gap-4">
                {/* Logo — fundo branco, sem cortes */}
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={settings.name}
                    className="w-[76px] h-[76px] rounded-2xl object-contain bg-white shadow-2xl flex-shrink-0 border-2 border-white/30"
                  />
                ) : (
                  <div
                    className="w-[76px] h-[76px] rounded-2xl flex items-center justify-center shadow-2xl flex-shrink-0 border-2 border-white/20"
                    style={{ backgroundColor: accent }}
                  >
                    <ChefHat className="w-9 h-9 text-white" />
                  </div>
                )}

                {/* Nome + descrição */}
                <div className="flex-1 min-w-0 pb-1">
                  <h1 className="text-xl font-extrabold text-white leading-tight tracking-tight drop-shadow-sm">
                    {settings.name}
                  </h1>
                  {settings.description && (
                    <p className="text-white/70 text-sm mt-1 line-clamp-2 leading-snug">
                      {settings.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Barra de info abaixo da capa */}
          <div className="bg-white border-b border-slate-100 shadow-sm">
            <div className="max-w-xl mx-auto px-5 py-3 flex flex-wrap gap-3 items-center">
              {(() => {
                const open = isRestaurantOpen(settings);
                return (
                  <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${open ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {open ? 'Aberto agora' : 'Fechado'}
                  </span>
                );
              })()}
              {mesaParam && (
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-600">
                  <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0" /> {mesaParam}
                </span>
              )}
              {settings.deliveryTime && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> {settings.deliveryTime} min
                </span>
              )}
              {settings.address && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> {settings.address}
                </span>
              )}
              {settings.phone && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> {settings.phone}
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ── WITHOUT COVER (accent color background) ── */
        <div className="relative overflow-hidden" style={{ background: accent }}>
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20" style={{ background: 'rgba(255,255,255,0.3)' }} />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ background: 'rgba(255,255,255,0.4)' }} />

          <div className="relative max-w-xl mx-auto px-5 pt-12 pb-20">
            {/* Account button */}
            <div className="absolute top-3 right-5">
              {customer ? (
                <button onClick={() => navigate(`/m/${slug}/conta`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold hover:bg-white/30 transition-colors">
                  <User className="w-3.5 h-3.5" /> Meus pedidos
                </button>
              ) : (
                <button onClick={() => { setShowCart(true); setStep('auth'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold hover:bg-white/30 transition-colors">
                  <LogIn className="w-3.5 h-3.5" /> Entrar
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
      )}

      {/* ── CATEGORY BAR ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-black/5 shadow-sm">
        {/* Search bar */}
        <div className="max-w-xl mx-auto px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              placeholder="Buscar no cardápio..."
              className="w-full pl-9 pr-9 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-colors"
            />
            {menuSearch && (
              <button onClick={() => setMenuSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>
        {/* Category pills — hidden while searching */}
        {!menuSearch && (
          <div ref={catBarRef} className="max-w-xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
        )}
      </div>

      {/* ── MENU ITEMS ── */}
      <div className="max-w-xl mx-auto px-4 pb-36 pt-2">
        {/* Search results */}
        {searchResults !== null && (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Nenhum item encontrado para "<strong>{menuSearch}</strong>"</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 font-medium px-1">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{menuSearch}"</p>
                {searchResults.map(item => {
                  const inCart = cart.find(c => c.menuItemId === item.id);
                  return (
                    <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-black/5 flex items-stretch cursor-pointer" onClick={() => openItemModal(item)}>
                      <div className="w-1 flex-shrink-0" style={{ backgroundColor: inCart ? accent : 'transparent' }} />
                      <div className="flex-1 p-3.5 flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl" style={{ backgroundColor: accent + '15' }}>
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-xl" /> : item.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                          {item.description && <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>}
                          <p className="font-extrabold text-sm mt-1" style={{ color: accent }}>R$ {item.price.toFixed(2).replace('.', ',')}</p>
                        </div>
                        {inCart && <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: accent }}>{inCart.quantity}x</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Featured items section */}
        {searchResults === null && !activeCat && (() => {
          const featuredItems = items.filter(i => i.featured && i.available && (i.stock == null || i.stock > 0));
          if (featuredItems.length === 0) return null;
          return (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Destaques</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {featuredItems.map(item => {
                  const effectivePrice = item.promoPrice ?? item.price;
                  return (
                    <button key={item.id} onClick={() => openItemModal(item)}
                      className="flex-shrink-0 w-40 bg-white rounded-2xl overflow-hidden shadow-sm border border-black/5 text-left active:scale-[0.97] transition-transform">
                      <div className="w-full h-28 overflow-hidden" style={{ backgroundColor: accent + '15' }}>
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-4xl">{item.emoji}</div>}
                      </div>
                      <div className="p-2.5">
                        <p className="font-bold text-slate-900 text-xs leading-tight line-clamp-2">{item.name}</p>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-sm font-extrabold" style={{ color: accent }}>R$ {effectivePrice.toFixed(2).replace('.', ',')}</span>
                          {item.promoPrice && <span className="text-[10px] text-slate-400 line-through">R$ {item.price.toFixed(2).replace('.', ',')}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Normal category view */}
        {searchResults === null && filteredCategories.map(cat => {
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
                  const outOfStock = item.stock != null && item.stock <= 0;
                  const effectiveUnavailable = !item.available || outOfStock;
                  const effectivePrice = item.promoPrice ?? item.price;
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
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {item.promoPrice ? (
                              <>
                                <p className="text-base font-extrabold tracking-tight" style={{ color: accent }}>
                                  R$ {item.promoPrice.toFixed(2).replace('.', ',')}
                                </p>
                                <p className="text-xs text-slate-400 line-through">
                                  R$ {item.price.toFixed(2).replace('.', ',')}
                                </p>
                              </>
                            ) : (
                              <p className="text-base font-extrabold tracking-tight" style={{ color: effectiveUnavailable ? '#94a3b8' : accent }}>
                                R$ {effectivePrice.toFixed(2).replace('.', ',')}
                              </p>
                            )}
                            {effectiveUnavailable && (
                              <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-full border border-red-100">Esgotado</span>
                            )}
                            {!effectiveUnavailable && item.stock != null && item.stock <= 5 && (
                              <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100">{item.stock} restam</span>
                            )}
                          </div>
                        </div>

                        {/* Add / Qty */}
                        <div className="flex-shrink-0">
                          {effectiveUnavailable ? (
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                              <X className="w-4 h-4 text-slate-400" />
                            </div>
                          ) : inCart ? (
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
                              onClick={() => openItemModal(item)}
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

        {searchResults === null && filteredCategories.length === 0 && (
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

      {/* ── ITEM MODAL ── */}
      {(loadingGroups || itemModal) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!loadingGroups) setItemModal(null); }} />
          <div className="relative w-full max-w-md bg-white flex flex-col shadow-2xl rounded-t-3xl sm:rounded-3xl" style={{ maxHeight: '90dvh' }}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0" />
            {loadingGroups ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
              </div>
            ) : itemModal && (
              <>
                <div className="flex items-start gap-4 px-5 pt-4 pb-4 flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden">
                    {itemModal.item.imageUrl ? (
                      <img src={itemModal.item.imageUrl} alt={itemModal.item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl" style={{ backgroundColor: accent + '15' }}>
                        {itemModal.item.emoji}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{itemModal.item.name}</h3>
                    {itemModal.item.description && (
                      <p className="text-sm text-slate-400 mt-0.5 leading-snug">{itemModal.item.description}</p>
                    )}
                    <p className="font-extrabold mt-1 text-base" style={{ color: accent }}>
                      R$ {itemModal.item.price.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <button onClick={() => setItemModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                <div className="h-px bg-slate-100 mx-5 flex-shrink-0" />
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
                  {itemModal.groups.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Sem opções adicionais</p>
                  )}
                  {itemModal.groups.map(group => (
                    <div key={group.id}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="font-bold text-slate-900 text-sm">{group.name}</span>
                        {group.required && (
                          <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-full border border-red-100">Obrigatório</span>
                        )}
                        {group.maxChoices > 1 && (
                          <span className="text-[10px] text-slate-400 font-medium">Até {group.maxChoices}</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {group.options.map(opt => {
                          const isSelected = selectedOptions[group.id]?.optionId === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setSelectedOptions(prev => {
                                  if (isSelected) { const next = { ...prev }; delete next[group.id]; return next; }
                                  return { ...prev, [group.id]: { groupId: group.id, optionId: opt.id, name: opt.name, priceDelta: opt.priceDelta } };
                                });
                              }}
                              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all duration-150"
                              style={isSelected ? { borderColor: accent, backgroundColor: accent + '08' } : { borderColor: '#f1f5f9', backgroundColor: '#f8fafc' }}
                            >
                              <div
                                className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                                style={isSelected ? { borderColor: accent, backgroundColor: accent } : { borderColor: '#e2e8f0' }}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="flex-1 text-sm font-semibold" style={isSelected ? { color: accent } : { color: '#374151' }}>{opt.name}</span>
                              {opt.priceDelta !== 0 && (
                                <span className="text-sm font-bold flex-shrink-0" style={{ color: accent }}>
                                  {opt.priceDelta > 0 ? '+' : ''}R$ {opt.priceDelta.toFixed(2).replace('.', ',')}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 pt-4 pb-6 flex-shrink-0 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">Quantidade</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setItemModalQty(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-full border-2 flex items-center justify-center" style={{ borderColor: accent }}>
                        <Minus className="w-4 h-4" style={{ color: accent }} />
                      </button>
                      <span className="text-lg font-extrabold w-6 text-center" style={{ color: accent }}>{itemModalQty}</span>
                      <button onClick={() => setItemModalQty(q => q + 1)} className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: accent }}>
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={confirmItemModal}
                    className="w-full py-4 rounded-2xl text-white font-extrabold text-base active:scale-[0.98] transition-transform shadow-lg flex items-center justify-center gap-2"
                    style={{ backgroundColor: accent, boxShadow: `0 8px 24px ${accent}40` }}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Adicionar • R$ {((itemModal.item.price + Object.values(selectedOptions).reduce((s, o) => s + o.priceDelta, 0)) * itemModalQty).toFixed(2).replace('.', ',')}
                  </button>
                </div>
              </>
            )}
          </div>
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

              {/* ── COUPON (cart step, below items) ── */}
              {step === 'cart' && cart.length > 0 && (
                <div className="px-5 pb-3">
                  {couponValid ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <Tag className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm text-emerald-700 font-semibold flex-1">{couponMsg}</span>
                      <button onClick={removeCoupon} className="text-emerald-600 hover:text-emerald-800 p-1 rounded-lg">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={couponCode}
                          onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponMsg(''); }}
                          onKeyDown={e => { if (e.key === 'Enter') applyCoupon(); }}
                          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold bg-slate-50 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 tracking-widest"
                          placeholder="Cupom de desconto"
                        />
                        <button
                          onClick={applyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-40 flex items-center gap-1.5"
                          style={{ backgroundColor: accent }}
                        >
                          {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                          Aplicar
                        </button>
                      </div>
                      {couponMsg && (
                        <p className="text-xs text-red-500 font-medium px-1">{couponMsg}</p>
                      )}
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
                  {/* Pickup / Delivery / Mesa toggle */}
                  <div className={`grid gap-2 p-1 bg-slate-100 rounded-2xl ${mesaParam ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {([
                      { value: 'pickup' as const, label: 'Retirada', icon: ShoppingBag },
                      { value: 'delivery' as const, label: 'Delivery', icon: Truck },
                      ...(mesaParam ? [{ value: 'table' as const, label: mesaParam, icon: LayoutGrid }] : []),
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDeliveryType(opt.value as 'pickup' | 'delivery' | 'table')}
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
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Observações (opcional)</label>
                      <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 bg-slate-50 transition-colors resize-none"
                        placeholder="Sem cebola, ponto da carne, alergia..." />
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
                        {settings.deliveryNeighborhoods && settings.deliveryNeighborhoods.length > 0 ? (
                          <select
                            value={address.neighborhood}
                            onChange={e => handleNeighborhoodChange(e.target.value)}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:border-slate-300"
                          >
                            <option value="">Bairro *</option>
                            {settings.deliveryNeighborhoods.map(n => (
                              <option key={n.name} value={n.name}>{n.name} — R$ {n.fee.toFixed(2).replace('.', ',')}</option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" value={address.neighborhood} onChange={e => setAddress(a => ({ ...a, neighborhood: e.target.value }))}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white placeholder:text-slate-300 focus:outline-none focus:border-slate-300"
                            placeholder="Bairro *" />
                        )}
                      </div>
                      {address.neighborhood && deliveryFee > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Truck className="w-3.5 h-3.5 text-slate-400" /> Taxa de entrega: <strong className="text-slate-700">R$ {deliveryFee.toFixed(2).replace('.', ',')}</strong>
                        </div>
                      )}
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

                  {/* Agendamento */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setScheduleEnabled(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700">Agendar para mais tarde</span>
                      </div>
                      <div className={`w-10 h-5 rounded-full flex items-center transition-colors duration-200 ${scheduleEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-transform duration-200 ${scheduleEnabled ? 'translate-x-5' : ''}`} />
                      </div>
                    </button>
                    {scheduleEnabled && (
                      <div className="px-4 pb-4 pt-0">
                        <input
                          type="datetime-local"
                          value={scheduledFor}
                          onChange={e => setScheduledFor(e.target.value)}
                          min={new Date(Date.now() + 15 * 60000).toISOString().slice(0, 16)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-slate-400"
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5">Seu pedido entrará na fila apenas no horário agendado.</p>
                      </div>
                    )}
                  </div>

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
                        { label: 'Subtotal', value: `R$ ${cartSubtotal.toFixed(2).replace('.', ',')}` },
                        ...(deliveryType === 'delivery' && deliveryFee > 0 ? [{ label: 'Taxa de entrega', value: `R$ ${deliveryFee.toFixed(2).replace('.', ',')}` }] : []),
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
                <div className="flex flex-col items-center py-8 px-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30">
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">Pago!</h3>
                  <p className="text-slate-400 mt-2 leading-relaxed text-sm">Seu pedido foi confirmado e está sendo preparado.</p>
                  {settings?.deliveryTime && deliveryType !== 'table' && (
                    <div className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-2xl bg-blue-50 border border-blue-100">
                      <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-blue-700">
                        Tempo estimado: {settings.deliveryTime} min
                      </span>
                    </div>
                  )}
                  {!ratingSubmitted && placedOrderId && (
                    <div className="w-full mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-sm font-bold text-slate-700 mb-3">Como foi sua experiência?</p>
                      <div className="flex justify-center gap-1 mb-3">
                        {[1,2,3,4,5].map(s => (
                          <button key={s} onClick={() => setOrderRating(s)} className="p-1 transition-transform active:scale-90">
                            <Star className={`w-8 h-8 ${s <= orderRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                          </button>
                        ))}
                      </div>
                      {orderRating > 0 && (
                        <>
                          <input value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white mb-2 focus:outline-none placeholder:text-slate-300"
                            placeholder="Deixe um comentário (opcional)" />
                          <button onClick={async () => {
                            if (!placedOrderId) return;
                            await db.updateOrder(placedOrderId, { rating: orderRating, ratingComment: ratingComment || undefined });
                            setRatingSubmitted(true);
                          }} className="w-full py-2.5 rounded-xl text-white text-sm font-bold" style={{ backgroundColor: accent }}>
                            Enviar avaliação
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {ratingSubmitted && <p className="text-sm text-emerald-600 font-semibold mt-4">Obrigado pela avaliação! ⭐</p>}
                  {loyaltyCount !== null && settings.loyaltyEnabled && customer && (
                    <div className="w-full mt-4 p-4 rounded-2xl border border-violet-100 bg-violet-50 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="w-4 h-4 text-violet-500 flex-shrink-0" />
                        <p className="text-sm font-bold text-violet-800">Programa de fidelidade</p>
                      </div>
                      {loyaltyCount > 0 && loyaltyCount % settings.loyaltyOrdersNeeded === 0 ? (
                        <p className="text-sm text-violet-700 font-semibold">🎉 Parabéns! Você ganhou: <span className="font-bold">{settings.loyaltyReward}</span></p>
                      ) : (
                        <>
                          <p className="text-xs text-violet-600 mb-2">{loyaltyCount % settings.loyaltyOrdersNeeded} de {settings.loyaltyOrdersNeeded} pedidos para ganhar: <strong>{settings.loyaltyReward}</strong></p>
                          <div className="w-full h-2 rounded-full bg-violet-200 overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, ((loyaltyCount % settings.loyaltyOrdersNeeded) / settings.loyaltyOrdersNeeded) * 100)}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {customer && (
                    <button onClick={() => { closeAndReset(); navigate(`/m/${slug}/conta`); }}
                      className="mt-4 px-5 py-2.5 rounded-2xl text-sm font-bold text-white" style={{ backgroundColor: accent }}>
                      Acompanhar pedido
                    </button>
                  )}
                </div>
              )}

              {/* ── STEP: ORDER PLACED ── */}
              {step === 'order_placed' && (
                <div className="flex flex-col items-center py-8 px-6 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-lg" style={{ backgroundColor: accent, boxShadow: `0 10px 40px ${accent}40` }}>
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">Pedido feito!</h3>
                  <p className="text-slate-400 mt-2 leading-relaxed text-sm">
                    {deliveryType === 'table'
                      ? `Seu pedido foi recebido para ${mesaParam}.`
                      : selectedPayment === 'cash'
                      ? `Pague em dinheiro na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.${cashChange ? ` Troco para R$ ${cashChange}.` : ''}`
                      : selectedPayment === 'meal_voucher'
                      ? `Apresente o vale-refeição na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.`
                      : `Pague com cartão na ${deliveryType === 'delivery' ? 'entrega' : 'retirada'}.`}
                  </p>
                  {settings?.deliveryTime && deliveryType !== 'table' && (
                    <div className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-2xl bg-blue-50 border border-blue-100">
                      <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-blue-700">
                        Tempo estimado: {settings.deliveryTime} min
                      </span>
                    </div>
                  )}
                  {!ratingSubmitted && placedOrderId && (
                    <div className="w-full mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-sm font-bold text-slate-700 mb-3">Como foi sua experiência?</p>
                      <div className="flex justify-center gap-1 mb-3">
                        {[1,2,3,4,5].map(s => (
                          <button key={s} onClick={() => setOrderRating(s)} className="p-1 transition-transform active:scale-90">
                            <Star className={`w-8 h-8 ${s <= orderRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                          </button>
                        ))}
                      </div>
                      {orderRating > 0 && (
                        <>
                          <input value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white mb-2 focus:outline-none placeholder:text-slate-300"
                            placeholder="Deixe um comentário (opcional)" />
                          <button onClick={async () => {
                            if (!placedOrderId) return;
                            await db.updateOrder(placedOrderId, { rating: orderRating, ratingComment: ratingComment || undefined });
                            setRatingSubmitted(true);
                          }} className="w-full py-2.5 rounded-xl text-white text-sm font-bold" style={{ backgroundColor: accent }}>
                            Enviar avaliação
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {ratingSubmitted && <p className="text-sm text-emerald-600 font-semibold mt-4">Obrigado pela avaliação! ⭐</p>}
                  {loyaltyCount !== null && settings.loyaltyEnabled && customer && (
                    <div className="w-full mt-4 p-4 rounded-2xl border border-violet-100 bg-violet-50 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="w-4 h-4 text-violet-500 flex-shrink-0" />
                        <p className="text-sm font-bold text-violet-800">Programa de fidelidade</p>
                      </div>
                      {loyaltyCount > 0 && loyaltyCount % settings.loyaltyOrdersNeeded === 0 ? (
                        <p className="text-sm text-violet-700 font-semibold">🎉 Parabéns! Você ganhou: <span className="font-bold">{settings.loyaltyReward}</span></p>
                      ) : (
                        <>
                          <p className="text-xs text-violet-600 mb-2">{loyaltyCount % settings.loyaltyOrdersNeeded} de {settings.loyaltyOrdersNeeded} pedidos para ganhar: <strong>{settings.loyaltyReward}</strong></p>
                          <div className="w-full h-2 rounded-full bg-violet-200 overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, ((loyaltyCount % settings.loyaltyOrdersNeeded) / settings.loyaltyOrdersNeeded) * 100)}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {customer && (
                    <button onClick={() => { closeAndReset(); navigate(`/m/${slug}/conta`); }}
                      className="mt-4 px-5 py-2.5 rounded-2xl text-sm font-bold text-white" style={{ backgroundColor: accent }}>
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
                  <div className="space-y-1.5 px-1 pb-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400 font-medium">Subtotal</span>
                      <span className="text-sm font-bold text-slate-700">R$ {cartSubtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    {deliveryType === 'delivery' && deliveryFee > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400 font-medium">Taxa de entrega</span>
                        <span className="text-sm font-bold text-slate-700">R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Desconto</span>
                        <span className="text-sm font-bold text-emerald-600">-R$ {couponDiscount.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                      <span className="text-sm font-bold text-slate-700">Total</span>
                      <span className="text-lg font-extrabold tracking-tight" style={{ color: accent }}>
                        R$ {Math.max(0, cartTotal).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
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
