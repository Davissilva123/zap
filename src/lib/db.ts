import { supabase } from './supabase';
import type { Category, MenuItem, Scan, RestaurantSettings, Order, OrderItem, PaymentMethod, DeliveryAddress, ItemGroup, ItemOption, OpeningHours, DeliveryNeighborhood, Coupon, RestaurantTable, Operator, Driver } from './types';

// ---- Supabase row shapes (snake_case) ----
interface SettingsRow {
  user_id: string; name: string; slug: string; accent_color: string;
  description: string; address: string; phone: string; logo_url: string; cover_url: string;
  xgate_email: string; xgate_password: string; payment_methods: string[];
  whatsapp_api_token: string; whatsapp_phone_number_id: string; whatsapp_enabled: boolean;
  opening_hours: OpeningHours; delivery_time: string; delivery_fee: number;
  delivery_neighborhoods: DeliveryNeighborhood[];
  loyalty_enabled: boolean; loyalty_orders_needed: number; loyalty_reward: string;
  cashback_percent: number;
  minimum_order: number;
  mercado_pago_token: string;
  manual_closed: boolean;
  blocked?: boolean;
  blocked_reason?: string;
  created_at: string;
}
interface CategoryRow { id: string; user_id: string; name: string; emoji: string; order: number; available_from?: string | null; available_to?: string | null; created_at: string; }
interface MenuItemRow { id: string; user_id: string; category_id: string; name: string; description: string; emoji: string; image_url: string; price: number; promo_price?: number | null; available: boolean; featured?: boolean; stock?: number | null; cost?: number | null; order: number; created_at: string; }
interface ScanRow { id: string; user_id: string; scanned_at: string; }
interface OrderRow { id: string; user_id: string; customer_user_id: string | null; items: OrderItem[]; total: number; discount: number; coupon_code: string | null; status: string; customer_name: string; customer_phone: string; payment_method: string; delivery_address: DeliveryAddress | null; delivery_type: string; table_name: string | null; notes?: string | null; driver_name?: string | null; driver_id?: string | null; pix_tx_id: string; pix_qr_code: string; pix_copy_paste: string; rating: number | null; rating_comment: string | null; scheduled_for: string | null; created_at: string; paid_at: string | null; }
interface ItemGroupRow { id: string; user_id: string; menu_item_id: string; name: string; required: boolean; min_choices: number; max_choices: number; order: number; created_at: string; }
interface ItemOptionRow { id: string; user_id: string; group_id: string; name: string; price_delta: number; order: number; created_at: string; }
interface CouponRow { id: string; user_id: string; code: string; discount_type: string; discount_value: number; min_order: number; max_uses: number | null; uses_count: number; active: boolean; expires_at: string | null; created_at: string; }
interface RestaurantTableRow { id: string; user_id: string; name: string; order: number; active: boolean; created_at: string; }
interface OperatorRow { id: string; owner_id: string; email: string; name: string; role: string; active: boolean; notes: string; created_at: string; user_id?: string | null; }
interface DriverRow { id: string; user_id: string; name: string; phone: string; active: boolean; access_token: string; created_at: string; }

// ---- Mappers ----
function toSettings(r: SettingsRow): RestaurantSettings {
  return {
    userId: r.user_id, name: r.name, slug: r.slug, accentColor: r.accent_color,
    description: r.description, address: r.address, phone: r.phone,
    logoUrl: r.logo_url, coverUrl: r.cover_url ?? '',
    xgateEmail: r.xgate_email, xgatePassword: r.xgate_password,
    paymentMethods: r.payment_methods as PaymentMethod[],
    whatsappApiToken: r.whatsapp_api_token, whatsappPhoneNumberId: r.whatsapp_phone_number_id,
    whatsappEnabled: r.whatsapp_enabled,
    openingHours: r.opening_hours ?? {},
    deliveryTime: r.delivery_time ?? '30-45',
    deliveryFee: Number(r.delivery_fee ?? 0),
    deliveryNeighborhoods: r.delivery_neighborhoods ?? [],
    loyaltyEnabled: r.loyalty_enabled ?? false,
    loyaltyOrdersNeeded: r.loyalty_orders_needed ?? 10,
    loyaltyReward: r.loyalty_reward ?? '',
    cashbackPercent: Number(r.cashback_percent ?? 0),
    minimumOrder: Number(r.minimum_order ?? 0),
    mercadoPagoToken: r.mercado_pago_token ?? '',
    manualClosed: r.manual_closed ?? false,
    blocked: r.blocked ?? false,
    blockedReason: r.blocked_reason ?? undefined,
  };
}
function toCategory(r: CategoryRow): Category { return { id: r.id, userId: r.user_id, name: r.name, emoji: r.emoji, order: r.order, availableFrom: r.available_from ?? undefined, availableTo: r.available_to ?? undefined, createdAt: r.created_at }; }
function toMenuItem(r: MenuItemRow): MenuItem { return { id: r.id, userId: r.user_id, categoryId: r.category_id, name: r.name, description: r.description, emoji: r.emoji, imageUrl: r.image_url ?? '', price: Number(r.price), promoPrice: r.promo_price ? Number(r.promo_price) : undefined, available: r.available, featured: r.featured ?? false, stock: r.stock ?? null, cost: r.cost ? Number(r.cost) : undefined, order: r.order, createdAt: r.created_at }; }
function toScan(r: ScanRow): Scan { return { id: r.id, userId: r.user_id, scannedAt: r.scanned_at }; }
function toOrder(r: OrderRow): Order { return { id: r.id, userId: r.user_id, customerUserId: r.customer_user_id ?? undefined, items: r.items, total: Number(r.total), discount: Number(r.discount ?? 0), couponCode: r.coupon_code ?? undefined, status: r.status as Order['status'], customerName: r.customer_name, customerPhone: r.customer_phone, paymentMethod: r.payment_method as PaymentMethod, deliveryAddress: r.delivery_address, deliveryType: r.delivery_type as Order['deliveryType'], tableName: r.table_name ?? undefined, notes: r.notes ?? undefined, driverName: r.driver_name ?? undefined, driverId: r.driver_id ?? undefined, pixTxId: r.pix_tx_id, pixQrCode: r.pix_qr_code, pixCopyPaste: r.pix_copy_paste, rating: r.rating ?? undefined, ratingComment: r.rating_comment ?? undefined, scheduledFor: r.scheduled_for ?? null, createdAt: r.created_at, paidAt: r.paid_at }; }
function toItemGroup(r: ItemGroupRow, options: ItemOption[] = []): ItemGroup { return { id: r.id, userId: r.user_id, menuItemId: r.menu_item_id, name: r.name, required: r.required, minChoices: r.min_choices, maxChoices: r.max_choices, order: r.order, options }; }
function toItemOption(r: ItemOptionRow): ItemOption { return { id: r.id, userId: r.user_id, groupId: r.group_id, name: r.name, priceDelta: Number(r.price_delta), order: r.order }; }
function toCoupon(r: CouponRow): Coupon { return { id: r.id, userId: r.user_id, code: r.code, discountType: r.discount_type as 'percent' | 'fixed', discountValue: Number(r.discount_value), minOrder: Number(r.min_order), maxUses: r.max_uses, usesCount: r.uses_count, active: r.active, expiresAt: r.expires_at, createdAt: r.created_at }; }
function toRestaurantTable(r: RestaurantTableRow): RestaurantTable { return { id: r.id, userId: r.user_id, name: r.name, order: r.order, active: r.active, createdAt: r.created_at }; }
function toOperator(r: OperatorRow): Operator { return { id: r.id, ownerId: r.owner_id, email: r.email, name: r.name, role: r.role as Operator['role'], active: r.active, notes: r.notes || '', createdAt: r.created_at, userId: r.user_id }; }
function toDriver(r: DriverRow): Driver { return { id: r.id, userId: r.user_id, name: r.name, phone: r.phone || '', active: r.active, accessToken: r.access_token, createdAt: r.created_at }; }

export const db = {
  // ---- Settings ----
  async ensureSettings(userId: string, name: string): Promise<void> {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await supabase.from('restaurant_settings').upsert({
      user_id: userId, name, slug, accent_color: '#059669', description: '', address: '', phone: '', logo_url: '', cover_url: '',
      xgate_email: '', xgate_password: '', payment_methods: ['pix', 'cash'],
      whatsapp_api_token: '', whatsapp_phone_number_id: '', whatsapp_enabled: false,
      opening_hours: {}, delivery_time: '30-45', delivery_fee: 0, delivery_neighborhoods: [],
    }, { onConflict: 'user_id', ignoreDuplicates: true });
  },

  async getAllRestaurants(): Promise<RestaurantSettings[]> {
    const { data, error } = await supabase.rpc('get_all_restaurants');
    if (error) throw error;
    return (data as SettingsRow[] || []).map(toSettings);
  },

  async getPlatformStats(): Promise<{ totalRestaurants: number; totalOrders: number; totalRevenue: number; ordersToday: number; revenueToday: number }> {
    const { data, error } = await supabase.rpc('get_platform_stats');
    if (error) throw error;
    const r = (data as any[])?.[0] ?? {};
    return {
      totalRestaurants: Number(r.total_restaurants ?? 0),
      totalOrders: Number(r.total_orders ?? 0),
      totalRevenue: Number(r.total_revenue ?? 0),
      ordersToday: Number(r.orders_today ?? 0),
      revenueToday: Number(r.revenue_today ?? 0),
    };
  },

  async getRestaurantStats(): Promise<Array<{ userId: string; orderCount: number; totalRevenue: number; lastOrderAt: string | null }>> {
    const { data, error } = await supabase.rpc('get_restaurant_stats');
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({
      userId: r.user_id,
      orderCount: Number(r.order_count ?? 0),
      totalRevenue: Number(r.total_revenue ?? 0),
      lastOrderAt: r.last_order_at ?? null,
    }));
  },

  async getRestaurantPlans(): Promise<Array<{ userId: string; planSlug: string; planName: string; planPrice: number; status: string; trialStartsAt: string | null; trialEndsAt: string | null; blockedReason: string | null; expiresAt: string | null }>> {
    const { data, error } = await supabase.rpc('get_all_restaurant_plans');
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({
      userId: r.user_id,
      planSlug: r.plan_slug,
      planName: r.plan_name,
      planPrice: Number(r.plan_price ?? 0),
      status: r.status,
      trialStartsAt: r.trial_starts_at ?? null,
      trialEndsAt: r.trial_ends_at ?? null,
      blockedReason: r.blocked_reason ?? null,
      expiresAt: r.expires_at ?? null,
    }));
  },

  async setRestaurantPlan(targetUserId: string, planSlug: string, status = 'active', notes?: string): Promise<void> {
    const { error } = await supabase.rpc('set_restaurant_plan', {
      p_target_user_id: targetUserId,
      p_plan_slug: planSlug,
      p_status: status,
      p_notes: notes ?? null,
    });
    if (error) throw error;
  },

  async getOwnerEmails(): Promise<Array<{ userId: string; email: string }>> {
    const { data, error } = await supabase.rpc('get_owner_emails');
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({ userId: r.user_id, email: r.email }));
  },

  async getMrrStats(): Promise<{ mrrCurrent: number; arr: number; activePaid: number; inTrial: number; trialsExpiring7d: number; churnedMonth: number; totalRestaurants: number }> {
    const { data, error } = await supabase.rpc('get_mrr_stats');
    if (error) throw error;
    const r = (data as any[])?.[0] ?? {};
    return {
      mrrCurrent: Number(r.mrr_current ?? 0),
      arr: Number(r.arr ?? 0),
      activePaid: Number(r.active_paid ?? 0),
      inTrial: Number(r.in_trial ?? 0),
      trialsExpiring7d: Number(r.trials_expiring_7d ?? 0),
      churnedMonth: Number(r.churned_month ?? 0),
      totalRestaurants: Number(r.total_restaurants ?? 0),
    };
  },

  async blockRestaurant(userId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('block_restaurant', { p_user_id: userId, p_reason: reason });
    if (error) throw error;
  },

  async unblockRestaurant(userId: string): Promise<void> {
    const { error } = await supabase.rpc('unblock_restaurant', { p_user_id: userId });
    if (error) throw error;
  },

  async getPlanChangeLog(userId?: string): Promise<Array<{ id: string; userId: string; oldPlanSlug: string | null; newPlanSlug: string; oldStatus: string | null; newStatus: string; notes: string | null; changedAt: string; changedByEmail: string | null }>> {
    const { data, error } = await supabase.rpc('get_plan_change_log', { p_user_id: userId ?? null });
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      oldPlanSlug: r.old_plan_slug ?? null,
      newPlanSlug: r.new_plan_slug,
      oldStatus: r.old_status ?? null,
      newStatus: r.new_status,
      notes: r.notes ?? null,
      changedAt: r.changed_at,
      changedByEmail: r.changed_by_email ?? null,
    }));
  },

  async getSettings(userId: string): Promise<RestaurantSettings | null> {
    const { data, error } = await supabase.from('restaurant_settings').select('*').eq('user_id', userId).maybeSingle();
    if (error) { console.error('[db.getSettings]', error); return null; }
    return data ? toSettings(data as SettingsRow) : null;
  },

  async updateSettings(userId: string, updates: Partial<RestaurantSettings>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.slug !== undefined) row.slug = updates.slug;
    if (updates.accentColor !== undefined) row.accent_color = updates.accentColor;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.address !== undefined) row.address = updates.address;
    if (updates.phone !== undefined) row.phone = updates.phone;
    if (updates.logoUrl !== undefined) row.logo_url = updates.logoUrl;
    if (updates.coverUrl !== undefined) row.cover_url = updates.coverUrl;
    if (updates.xgateEmail !== undefined) row.xgate_email = updates.xgateEmail;
    if (updates.xgatePassword !== undefined) row.xgate_password = updates.xgatePassword;
    if (updates.paymentMethods !== undefined) row.payment_methods = updates.paymentMethods;
    if (updates.whatsappApiToken !== undefined) row.whatsapp_api_token = updates.whatsappApiToken;
    if (updates.whatsappPhoneNumberId !== undefined) row.whatsapp_phone_number_id = updates.whatsappPhoneNumberId;
    if (updates.whatsappEnabled !== undefined) row.whatsapp_enabled = updates.whatsappEnabled;
    if (updates.openingHours !== undefined) row.opening_hours = updates.openingHours;
    if (updates.deliveryTime !== undefined) row.delivery_time = updates.deliveryTime;
    if (updates.deliveryFee !== undefined) row.delivery_fee = updates.deliveryFee;
    if (updates.deliveryNeighborhoods !== undefined) row.delivery_neighborhoods = updates.deliveryNeighborhoods;
    if (updates.loyaltyEnabled !== undefined) row.loyalty_enabled = updates.loyaltyEnabled;
    if (updates.loyaltyOrdersNeeded !== undefined) row.loyalty_orders_needed = updates.loyaltyOrdersNeeded;
    if (updates.loyaltyReward !== undefined) row.loyalty_reward = updates.loyaltyReward;
    if (updates.cashbackPercent !== undefined) row.cashback_percent = updates.cashbackPercent;
    if (updates.minimumOrder !== undefined) row.minimum_order = updates.minimumOrder;
    if (updates.mercadoPagoToken !== undefined) row.mercado_pago_token = updates.mercadoPagoToken;
    if (updates.manualClosed !== undefined) row.manual_closed = updates.manualClosed;
    await supabase.from('restaurant_settings').update(row).eq('user_id', userId);
  },

  // ---- Categories ----
  async getCategories(userId: string): Promise<Category[]> {
    const { data, error } = await supabase.from('categories').select('*').eq('user_id', userId).order('order', { ascending: true });
    if (error) { console.error('[db.getCategories]', error); return []; }
    return (data as CategoryRow[]).map(toCategory);
  },

  async addCategory(userId: string, name: string, emoji: string): Promise<Category> {
    const { data: existing } = await supabase.from('categories').select('order').eq('user_id', userId).order('order', { ascending: false }).limit(1);
    const maxOrder = existing && existing.length > 0 ? (existing[0] as { order: number }).order : -1;
    const { data, error } = await supabase.from('categories').insert({ user_id: userId, name, emoji, order: maxOrder + 1 }).select().single();
    if (error) throw error;
    return toCategory(data as CategoryRow);
  },

  async updateCategory(id: string, updates: Partial<Pick<Category, 'name' | 'emoji' | 'order' | 'availableFrom' | 'availableTo'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.emoji !== undefined) row.emoji = updates.emoji;
    if (updates.order !== undefined) row.order = updates.order;
    if (updates.availableFrom !== undefined) row.available_from = updates.availableFrom || null;
    if (updates.availableTo !== undefined) row.available_to = updates.availableTo || null;
    await supabase.from('categories').update(row).eq('id', id);
  },

  async deleteCategory(id: string): Promise<void> {
    await supabase.from('categories').delete().eq('id', id);
  },

  // ---- Menu Items ----
  async getMenuItems(userId: string): Promise<MenuItem[]> {
    const { data, error } = await supabase.from('menu_items').select('*').eq('user_id', userId).order('order', { ascending: true });
    if (error) { console.error('[db.getMenuItems]', error); return []; }
    return (data as MenuItemRow[]).map(toMenuItem);
  },

  async addMenuItem(userId: string, item: Omit<MenuItem, 'id' | 'userId' | 'createdAt' | 'order'>): Promise<MenuItem> {
    const { data: existing } = await supabase.from('menu_items').select('order').eq('user_id', userId).order('order', { ascending: false }).limit(1);
    const maxOrder = existing && existing.length > 0 ? (existing[0] as { order: number }).order : -1;
    const { data, error } = await supabase.from('menu_items').insert({ user_id: userId, category_id: item.categoryId, name: item.name, description: item.description, emoji: item.emoji, image_url: item.imageUrl ?? '', price: item.price, promo_price: item.promoPrice ?? null, available: item.available, featured: item.featured ?? false, stock: item.stock ?? null, cost: item.cost ?? null, order: maxOrder + 1 }).select().single();
    if (error) throw error;
    return toMenuItem(data as MenuItemRow);
  },

  async updateMenuItem(id: string, updates: Partial<Pick<MenuItem, 'name' | 'description' | 'price' | 'promoPrice' | 'emoji' | 'imageUrl' | 'available' | 'featured' | 'stock' | 'cost' | 'categoryId' | 'order'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.price !== undefined) row.price = updates.price;
    if (updates.promoPrice !== undefined) row.promo_price = updates.promoPrice || null;
    if (updates.emoji !== undefined) row.emoji = updates.emoji;
    if (updates.imageUrl !== undefined) row.image_url = updates.imageUrl;
    if (updates.available !== undefined) row.available = updates.available;
    if (updates.featured !== undefined) row.featured = updates.featured;
    if (updates.stock !== undefined) row.stock = updates.stock;
    if (updates.cost !== undefined) row.cost = updates.cost || null;
    if (updates.categoryId !== undefined) row.category_id = updates.categoryId;
    if (updates.order !== undefined) row.order = updates.order;
    await supabase.from('menu_items').update(row).eq('id', id);
  },

  async deleteMenuItem(id: string): Promise<void> {
    await supabase.from('menu_items').delete().eq('id', id);
  },

  // ---- Item Groups & Options ----
  async getItemGroups(menuItemId: string): Promise<ItemGroup[]> {
    const { data: groupsData, error } = await supabase
      .from('item_groups').select('*').eq('menu_item_id', menuItemId).order('order', { ascending: true });
    if (error || !groupsData?.length) return [];
    const groupIds = (groupsData as ItemGroupRow[]).map(g => g.id);
    const { data: optionsData } = await supabase
      .from('item_options').select('*').in('group_id', groupIds).order('order', { ascending: true });
    const options = (optionsData as ItemOptionRow[] || []).map(toItemOption);
    return (groupsData as ItemGroupRow[]).map(g =>
      toItemGroup(g, options.filter(o => o.groupId === g.id))
    );
  },

  async addItemGroup(userId: string, menuItemId: string, group: Omit<ItemGroup, 'id' | 'userId' | 'menuItemId' | 'options'>): Promise<ItemGroup> {
    const { data, error } = await supabase.from('item_groups')
      .insert({ user_id: userId, menu_item_id: menuItemId, name: group.name, required: group.required, min_choices: group.minChoices, max_choices: group.maxChoices, order: group.order })
      .select().single();
    if (error) throw new Error(error.message);
    return toItemGroup(data as ItemGroupRow, []);
  },

  async updateItemGroup(id: string, updates: Partial<Pick<ItemGroup, 'name' | 'required' | 'minChoices' | 'maxChoices'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.required !== undefined) row.required = updates.required;
    if (updates.minChoices !== undefined) row.min_choices = updates.minChoices;
    if (updates.maxChoices !== undefined) row.max_choices = updates.maxChoices;
    await supabase.from('item_groups').update(row).eq('id', id);
  },

  async deleteItemGroup(id: string): Promise<void> {
    await supabase.from('item_groups').delete().eq('id', id);
  },

  async addItemOption(userId: string, groupId: string, option: Omit<ItemOption, 'id' | 'userId' | 'groupId'>): Promise<ItemOption> {
    const { data, error } = await supabase.from('item_options')
      .insert({ user_id: userId, group_id: groupId, name: option.name, price_delta: option.priceDelta, order: option.order })
      .select().single();
    if (error) throw new Error(error.message);
    return toItemOption(data as ItemOptionRow);
  },

  async updateItemOption(id: string, updates: Partial<Pick<ItemOption, 'name' | 'priceDelta'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.priceDelta !== undefined) row.price_delta = updates.priceDelta;
    await supabase.from('item_options').update(row).eq('id', id);
  },

  async deleteItemOption(id: string): Promise<void> {
    await supabase.from('item_options').delete().eq('id', id);
  },

  // ---- Scans ----
  async getScans(userId: string): Promise<Scan[]> {
    const { data, error } = await supabase.from('scans').select('*').eq('user_id', userId);
    if (error) { console.error('[db.getScans]', error); return []; }
    return (data as ScanRow[]).map(toScan);
  },

  async addScan(userId: string): Promise<void> {
    await supabase.from('scans').insert({ user_id: userId });
  },

  // ---- Public Menu ----
  async getPublicMenu(slug: string): Promise<{ settings: RestaurantSettings; categories: Category[]; items: MenuItem[] } | null> {
    const { data: settingsData } = await supabase.from('restaurant_settings').select('*').eq('slug', slug).maybeSingle();
    if (!settingsData) return null;
    const settings = toSettings(settingsData as SettingsRow);
    const [{ data: catsData }, { data: itemsData }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', settings.userId).order('order', { ascending: true }),
      supabase.from('menu_items').select('*').eq('user_id', settings.userId).order('order', { ascending: true }),
    ]);
    return { settings, categories: (catsData as CategoryRow[] || []).map(toCategory), items: (itemsData as MenuItemRow[] || []).map(toMenuItem) };
  },

  async getItemGroupsForItems(menuItemIds: string[]): Promise<ItemGroup[]> {
    if (!menuItemIds.length) return [];
    const { data: groupsData } = await supabase
      .from('item_groups').select('*').in('menu_item_id', menuItemIds).order('order', { ascending: true });
    if (!groupsData?.length) return [];
    const groupIds = (groupsData as ItemGroupRow[]).map(g => g.id);
    const { data: optionsData } = await supabase
      .from('item_options').select('*').in('group_id', groupIds).order('order', { ascending: true });
    const options = (optionsData as ItemOptionRow[] || []).map(toItemOption);
    return (groupsData as ItemGroupRow[]).map(g =>
      toItemGroup(g, options.filter(o => o.groupId === g.id))
    );
  },

  // ---- Public Reviews ----
  async getPublicReviews(userId: string): Promise<Array<{ name: string; rating: number; comment: string; createdAt: string }>> {
    const { data } = await supabase
      .from('orders')
      .select('customer_name, rating, rating_comment, created_at')
      .eq('user_id', userId)
      .not('rating', 'is', null)
      .gt('rating', 0)
      .order('created_at', { ascending: false })
      .limit(8);
    if (!data) return [];
    return (data as Array<{ customer_name: string; rating: number; rating_comment: string | null; created_at: string }>)
      .map(r => ({ name: r.customer_name, rating: r.rating, comment: r.rating_comment || '', createdAt: r.created_at }));
  },

  // ---- Orders ----
  async getOrders(userId: string): Promise<Order[]> {
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) { console.error('[db.getOrders]', error); return []; }
    return (data as OrderRow[]).map(toOrder);
  },

  async addOrder(order: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const baseRow: Record<string, unknown> = {
      user_id: order.userId,
      items: order.items, total: order.total, discount: order.discount ?? 0,
      coupon_code: order.couponCode ?? null,
      status: order.status,
      customer_name: order.customerName, customer_phone: order.customerPhone,
      payment_method: order.paymentMethod, delivery_address: order.deliveryAddress,
      delivery_type: order.deliveryType, table_name: order.tableName ?? null,
      notes: order.notes ?? null,
      pix_tx_id: order.pixTxId ?? '',
      pix_qr_code: order.pixQrCode ?? '', pix_copy_paste: order.pixCopyPaste ?? '', paid_at: order.paidAt,
    };
    // optional columns — added via migrations; include only when available
    if (order.scheduledFor) baseRow.scheduled_for = order.scheduledFor;
    const row = order.customerUserId ? { ...baseRow, customer_user_id: order.customerUserId } : baseRow;
    const { data, error } = await supabase.from('orders').insert(row).select().single();
    if (error?.message?.includes('customer_user_id')) {
      const { data: d2, error: e2 } = await supabase.from('orders').insert(baseRow).select().single();
      if (e2) throw new Error(e2.message || JSON.stringify(e2));
      return toOrder(d2 as OrderRow);
    }
    if (error?.message?.includes('scheduled_for')) {
      const rowWithout = { ...row };
      delete rowWithout.scheduled_for;
      const { data: d3, error: e3 } = await supabase.from('orders').insert(rowWithout).select().single();
      if (e3) throw new Error(e3.message || JSON.stringify(e3));
      return toOrder(d3 as OrderRow);
    }
    if (error) throw new Error(error.message || JSON.stringify(error));
    return toOrder(data as OrderRow);
  },

  async updateOrder(id: string, updates: Partial<Pick<Order, 'status' | 'paidAt' | 'rating' | 'ratingComment' | 'items' | 'total' | 'driverName' | 'driverId'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.paidAt !== undefined) row.paid_at = updates.paidAt;
    if (updates.rating !== undefined) row.rating = updates.rating;
    if (updates.ratingComment !== undefined) row.rating_comment = updates.ratingComment;
    if (updates.items !== undefined) row.items = updates.items;
    if (updates.total !== undefined) row.total = updates.total;
    if (updates.driverName !== undefined) row.driver_name = updates.driverName || null;
    if (updates.driverId !== undefined) row.driver_id = updates.driverId || null;
    await supabase.from('orders').update(row).eq('id', id);
  },

  // ---- Coupons ----
  async getCoupons(userId: string): Promise<Coupon[]> {
    const { data, error } = await supabase.from('coupons').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) { console.error('[db.getCoupons]', error); return []; }
    return (data as CouponRow[]).map(toCoupon);
  },

  async addCoupon(userId: string, coupon: Omit<Coupon, 'id' | 'userId' | 'usesCount' | 'createdAt'>): Promise<Coupon> {
    const { data, error } = await supabase.from('coupons').insert({
      user_id: userId, code: coupon.code.toUpperCase(), discount_type: coupon.discountType,
      discount_value: coupon.discountValue, min_order: coupon.minOrder,
      max_uses: coupon.maxUses, active: coupon.active, expires_at: coupon.expiresAt,
    }).select().single();
    if (error) throw new Error(error.message);
    return toCoupon(data as CouponRow);
  },

  async updateCoupon(id: string, updates: Partial<Omit<Coupon, 'id' | 'userId' | 'createdAt'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.active !== undefined) row.active = updates.active;
    if (updates.discountValue !== undefined) row.discount_value = updates.discountValue;
    if (updates.maxUses !== undefined) row.max_uses = updates.maxUses;
    if (updates.expiresAt !== undefined) row.expires_at = updates.expiresAt;
    await supabase.from('coupons').update(row).eq('id', id);
  },

  async deleteCoupon(id: string): Promise<void> {
    await supabase.from('coupons').delete().eq('id', id);
  },

  async validateCoupon(userId: string, code: string, orderTotal: number): Promise<{ valid: boolean; discount: number; message?: string; coupon?: Coupon }> {
    const { data, error } = await supabase.from('coupons').select('*').eq('user_id', userId).eq('code', code.toUpperCase().trim()).maybeSingle();
    if (error || !data) return { valid: false, discount: 0, message: 'Cupom não encontrado' };
    const coupon = toCoupon(data as CouponRow);
    if (!coupon.active) return { valid: false, discount: 0, message: 'Cupom inativo' };
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { valid: false, discount: 0, message: 'Cupom expirado' };
    if (coupon.maxUses !== null && coupon.usesCount >= coupon.maxUses) return { valid: false, discount: 0, message: 'Cupom esgotado' };
    if (orderTotal < coupon.minOrder) return { valid: false, discount: 0, message: `Pedido mínimo: R$ ${coupon.minOrder.toFixed(2).replace('.', ',')}` };
    const discount = coupon.discountType === 'percent'
      ? Math.round(orderTotal * (coupon.discountValue / 100) * 100) / 100
      : Math.min(orderTotal, coupon.discountValue);
    return { valid: true, discount, coupon };
  },

  async useCoupon(couponId: string, currentUses: number): Promise<void> {
    await supabase.from('coupons').update({ uses_count: currentUses + 1 }).eq('id', couponId);
  },

  async getCustomerOrderCount(restaurantId: string, customerUserId: string): Promise<number> {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', restaurantId)
      .eq('customer_user_id', customerUserId)
      .not('status', 'eq', 'CANCELLED');
    if (error) return 0;
    return count ?? 0;
  },

  // ---- Tables (Mesas) ----
  async getTables(userId: string): Promise<RestaurantTable[]> {
    const { data, error } = await supabase.from('restaurant_tables').select('*').eq('user_id', userId).order('order', { ascending: true });
    if (error) { console.error('[db.getTables]', error); return []; }
    return (data as RestaurantTableRow[]).map(toRestaurantTable);
  },

  async addTable(userId: string, name: string): Promise<RestaurantTable> {
    const { data: existing } = await supabase.from('restaurant_tables').select('order').eq('user_id', userId).order('order', { ascending: false }).limit(1);
    const maxOrder = existing && existing.length > 0 ? (existing[0] as { order: number }).order : -1;
    const { data, error } = await supabase.from('restaurant_tables').insert({ user_id: userId, name, order: maxOrder + 1 }).select().single();
    if (error) throw new Error(error.message);
    return toRestaurantTable(data as RestaurantTableRow);
  },

  async updateTable(id: string, updates: Partial<Pick<RestaurantTable, 'name' | 'active'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.active !== undefined) row.active = updates.active;
    await supabase.from('restaurant_tables').update(row).eq('id', id);
  },

  async deleteTable(id: string): Promise<void> {
    await supabase.from('restaurant_tables').delete().eq('id', id);
  },

  async getOperatorByEmail(email: string): Promise<import('./auth').OperatorInfo | null> {
    if (!email) return null;
    const { data: opData, error } = await supabase
      .from('operators')
      .select('owner_id, role, name')
      .eq('email', email.toLowerCase())
      .eq('active', true)
      .maybeSingle();
    if (error || !opData) return null;
    const { data: settingsData } = await supabase
      .from('restaurant_settings')
      .select('name')
      .eq('user_id', opData.owner_id)
      .maybeSingle();
    return {
      ownerId: opData.owner_id,
      role: opData.role as 'admin' | 'waiter' | 'cashier' | 'kitchen',
      restaurantName: (settingsData as { name: string } | null)?.name || 'Restaurante',
      operatorName: opData.name,
    };
  },

  // ---- Operators ----
  async getOperators(ownerId: string): Promise<Operator[]> {
    const { data, error } = await supabase.from('operators').select('*').eq('owner_id', ownerId).order('created_at', { ascending: true });
    if (error) { console.error('[db.getOperators]', error); return []; }
    return (data as OperatorRow[]).map(toOperator);
  },

  async addOperator(ownerId: string, op: Omit<Operator, 'id' | 'ownerId' | 'createdAt'>): Promise<Operator> {
    const { data, error } = await supabase.from('operators').insert({ owner_id: ownerId, email: op.email, name: op.name, role: op.role, active: op.active, notes: op.notes }).select().single();
    if (error) throw new Error(error.message);
    return toOperator(data as OperatorRow);
  },

  async updateOperator(id: string, updates: Partial<Pick<Operator, 'name' | 'role' | 'active' | 'notes'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.role !== undefined) row.role = updates.role;
    if (updates.active !== undefined) row.active = updates.active;
    if (updates.notes !== undefined) row.notes = updates.notes;
    await supabase.from('operators').update(row).eq('id', id);
  },

  async deleteOperator(id: string): Promise<void> {
    await supabase.from('operators').delete().eq('id', id);
  },

  // ---- Drivers (Entregadores) ----
  async getDrivers(userId: string): Promise<Driver[]> {
    const { data, error } = await supabase.from('drivers').select('*').eq('user_id', userId).order('name', { ascending: true });
    if (error) { console.error('[db.getDrivers]', error); return []; }
    return (data as DriverRow[]).map(toDriver);
  },

  async createDriver(userId: string, d: Pick<Driver, 'name' | 'phone' | 'active'>): Promise<Driver> {
    const { data, error } = await supabase.from('drivers').insert({ user_id: userId, name: d.name, phone: d.phone, active: d.active }).select().single();
    if (error) throw new Error(error.message);
    return toDriver(data as DriverRow);
  },

  async updateDriver(id: string, updates: Partial<Pick<Driver, 'name' | 'phone' | 'active'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.phone !== undefined) row.phone = updates.phone;
    if (updates.active !== undefined) row.active = updates.active;
    await supabase.from('drivers').update(row).eq('id', id);
  },

  async deleteDriver(id: string): Promise<void> {
    await supabase.from('drivers').delete().eq('id', id);
  },

  // ---- Admin: Analytics ----
  async getMrrByPlan(): Promise<Array<{ planSlug: string; planName: string; planPrice: number; activeCount: number; mrr: number }>> {
    const { data, error } = await supabase.rpc('get_mrr_by_plan');
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({
      planSlug: r.plan_slug,
      planName: r.plan_name,
      planPrice: Number(r.plan_price ?? 0),
      activeCount: Number(r.active_count ?? 0),
      mrr: Number(r.mrr ?? 0),
    }));
  },

  async getMrrHistory(): Promise<Array<{ month: string; mrrValue: number; activePaid: number; inTrial: number }>> {
    const { data, error } = await supabase.rpc('get_mrr_history');
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({
      month: r.month,
      mrrValue: Number(r.mrr_value ?? 0),
      activePaid: Number(r.active_paid ?? 0),
      inTrial: Number(r.in_trial ?? 0),
    }));
  },

  async getOnboardingFunnel(): Promise<Array<{ stage: string; count: number }>> {
    const { data, error } = await supabase.rpc('get_onboarding_funnel');
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({ stage: r.stage, count: Number(r.count ?? 0) }));
  },

  async getChurnReport(): Promise<Array<{ userId: string; restaurantName: string; oldPlan: string; churnReason: string; churnedAt: string }>> {
    const { data, error } = await supabase.rpc('get_churn_report');
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({
      userId: r.user_id,
      restaurantName: r.restaurant_name,
      oldPlan: r.old_plan,
      churnReason: r.churn_reason,
      churnedAt: r.churned_at,
    }));
  },

  // ---- Admin: Notas Internas ----
  async getRestaurantNotes(userId: string): Promise<Array<{ id: string; note: string; createdBy: string; createdAt: string }>> {
    const { data, error } = await supabase.rpc('get_restaurant_notes', { p_user_id: userId });
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({ id: r.id, note: r.note, createdBy: r.created_by, createdAt: r.created_at }));
  },

  async addRestaurantNote(userId: string, note: string): Promise<void> {
    const { error } = await supabase.rpc('add_restaurant_note', { p_user_id: userId, p_note: note });
    if (error) throw error;
  },

  async deleteRestaurantNote(noteId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_restaurant_note', { p_note_id: noteId });
    if (error) throw error;
  },

  // ---- Admin: Feature Flags ----
  async getFeatureFlags(userId: string): Promise<Record<string, boolean>> {
    const { data, error } = await supabase.rpc('get_feature_flags', { p_user_id: userId });
    if (error) throw error;
    const result: Record<string, boolean> = {};
    ((data as any[]) ?? []).forEach(r => { result[r.flag_name] = r.enabled; });
    return result;
  },

  async setFeatureFlag(userId: string, flagName: string, enabled: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_feature_flag', { p_user_id: userId, p_flag_name: flagName, p_enabled: enabled });
    if (error) throw error;
  },

  // ---- Admin: Notificações ----
  async getAdminNotifications(): Promise<Array<{ id: string; type: string; title: string; body: string | null; userId: string | null; read: boolean; createdAt: string }>> {
    const { data, error } = await supabase.rpc('get_admin_notifications');
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({
      id: r.id, type: r.type, title: r.title, body: r.body ?? null,
      userId: r.user_id ?? null, read: r.read, createdAt: r.created_at,
    }));
  },

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await supabase.rpc('mark_notification_read', { p_id: id });
    if (error) throw error;
  },

  async markAllNotificationsRead(): Promise<void> {
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) throw error;
  },

  // ---- Admin: Cupons de Assinatura ----
  async getSubscriptionCoupons(): Promise<Array<{ id: string; code: string; discountType: string; discountValue: number; maxUses: number | null; usesCount: number; active: boolean; expiresAt: string | null; createdAt: string }>> {
    const { data, error } = await supabase.rpc('get_subscription_coupons');
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({
      id: r.id, code: r.code, discountType: r.discount_type,
      discountValue: Number(r.discount_value), maxUses: r.max_uses ?? null,
      usesCount: Number(r.uses_count), active: r.active,
      expiresAt: r.expires_at ?? null, createdAt: r.created_at,
    }));
  },

  async createSubscriptionCoupon(code: string, discountType: string, discountValue: number, maxUses?: number | null, expiresAt?: string | null): Promise<void> {
    const { error } = await supabase.rpc('create_subscription_coupon', {
      p_code: code, p_discount_type: discountType, p_discount_value: discountValue,
      p_max_uses: maxUses ?? null, p_expires_at: expiresAt ?? null,
    });
    if (error) throw error;
  },

  async toggleSubscriptionCoupon(id: string): Promise<void> {
    const { error } = await supabase.rpc('toggle_subscription_coupon', { p_id: id });
    if (error) throw error;
  },

  async deleteSubscriptionCoupon(id: string): Promise<void> {
    const { error } = await supabase.rpc('delete_subscription_coupon', { p_id: id });
    if (error) throw error;
  },

  // ---- Admin: Detalhe do Restaurante (impersonação read-only) ----
  async getRestaurantDetailAdmin(userId: string): Promise<{
    restaurantName: string; slug: string; phone: string; address: string;
    logoUrl: string; coverUrl: string; description: string;
    planSlug: string; planName: string; planPrice: number;
    planStatus: string; trialEndsAt: string | null;
    paymentStatus: string; stripeSubscriptionId: string | null;
    orderCount: number; totalRevenue: number; lastOrderAt: string | null;
    blocked: boolean; blockedReason: string | null;
  } | null> {
    const { data, error } = await supabase.rpc('get_restaurant_detail_admin', { p_user_id: userId });
    if (error) throw error;
    const r = (data as any[])?.[0];
    if (!r) return null;
    return {
      restaurantName: r.restaurant_name, slug: r.slug, phone: r.phone, address: r.address,
      logoUrl: r.logo_url, coverUrl: r.cover_url, description: r.description,
      planSlug: r.plan_slug, planName: r.plan_name, planPrice: Number(r.plan_price ?? 0),
      planStatus: r.plan_status, trialEndsAt: r.trial_ends_at ?? null,
      paymentStatus: r.payment_status, stripeSubscriptionId: r.stripe_subscription_id ?? null,
      orderCount: Number(r.order_count ?? 0), totalRevenue: Number(r.total_revenue ?? 0),
      lastOrderAt: r.last_order_at ?? null,
      blocked: r.blocked ?? false, blockedReason: r.blocked_reason ?? null,
    };
  },

  async getRestaurantOrdersAdmin(userId: string): Promise<Array<{ id: string; status: string; total: number; customerName: string; deliveryType: string; paymentMethod: string; createdAt: string }>> {
    const { data, error } = await supabase.rpc('get_restaurant_orders_admin', { p_user_id: userId });
    if (error) throw error;
    return ((data as any[]) ?? []).map(r => ({
      id: r.id, status: r.status, total: Number(r.total),
      customerName: r.customer_name, deliveryType: r.delivery_type,
      paymentMethod: r.payment_method, createdAt: r.created_at,
    }));
  },

  // ---- Driver Portal (sem auth, via access_token) ----
  async getDriverByToken(token: string): Promise<{ id: string; name: string; phone: string } | null> {
    const { data, error } = await supabase.rpc('get_driver_by_token', { p_token: token });
    if (error || !data || (data as unknown[]).length === 0) return null;
    const row = (data as Array<{ id: string; name: string; phone: string }>)[0];
    return { id: row.id, name: row.name, phone: row.phone };
  },

  async getDriverOrders(token: string): Promise<Order[]> {
    const { data, error } = await supabase.rpc('get_driver_orders', { p_token: token });
    if (error || !data) return [];
    return (data as OrderRow[]).map(toOrder);
  },

  async completeDriverOrder(token: string, orderId: string): Promise<void> {
    await supabase.rpc('complete_driver_order', { p_token: token, p_order_id: orderId });
  },
};
