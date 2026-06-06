import { supabase } from './supabase';
import type { Category, MenuItem, Scan, RestaurantSettings, Order, OrderItem, PaymentMethod, DeliveryAddress } from './types';

// ---- Supabase row shapes (snake_case) ----
interface SettingsRow {
  user_id: string; name: string; slug: string; accent_color: string;
  description: string; address: string; phone: string; logo_url: string; cover_url: string;
  xgate_email: string; xgate_password: string; payment_methods: string[];
  whatsapp_api_token: string; whatsapp_phone_number_id: string; whatsapp_enabled: boolean;
  created_at: string;
}
interface CategoryRow { id: string; user_id: string; name: string; emoji: string; order: number; created_at: string; }
interface MenuItemRow { id: string; user_id: string; category_id: string; name: string; description: string; emoji: string; image_url: string; price: number; available: boolean; order: number; created_at: string; }
interface ScanRow { id: string; user_id: string; scanned_at: string; }
interface OrderRow { id: string; user_id: string; customer_user_id: string | null; items: OrderItem[]; total: number; status: string; customer_name: string; customer_phone: string; payment_method: string; delivery_address: DeliveryAddress | null; delivery_type: string; pix_tx_id: string; pix_qr_code: string; pix_copy_paste: string; created_at: string; paid_at: string | null; }

// ---- Mappers ----
function toSettings(r: SettingsRow): RestaurantSettings {
  return { userId: r.user_id, name: r.name, slug: r.slug, accentColor: r.accent_color, description: r.description, address: r.address, phone: r.phone, logoUrl: r.logo_url, coverUrl: r.cover_url ?? '', xgateEmail: r.xgate_email, xgatePassword: r.xgate_password, paymentMethods: r.payment_methods as PaymentMethod[], whatsappApiToken: r.whatsapp_api_token, whatsappPhoneNumberId: r.whatsapp_phone_number_id, whatsappEnabled: r.whatsapp_enabled };
}
function toCategory(r: CategoryRow): Category { return { id: r.id, userId: r.user_id, name: r.name, emoji: r.emoji, order: r.order, createdAt: r.created_at }; }
function toMenuItem(r: MenuItemRow): MenuItem { return { id: r.id, userId: r.user_id, categoryId: r.category_id, name: r.name, description: r.description, emoji: r.emoji, imageUrl: r.image_url ?? '', price: Number(r.price), available: r.available, order: r.order, createdAt: r.created_at }; }
function toScan(r: ScanRow): Scan { return { id: r.id, userId: r.user_id, scannedAt: r.scanned_at }; }
function toOrder(r: OrderRow): Order { return { id: r.id, userId: r.user_id, customerUserId: r.customer_user_id ?? undefined, items: r.items, total: Number(r.total), status: r.status as Order['status'], customerName: r.customer_name, customerPhone: r.customer_phone, paymentMethod: r.payment_method as PaymentMethod, deliveryAddress: r.delivery_address, deliveryType: r.delivery_type as 'pickup' | 'delivery', pixTxId: r.pix_tx_id, pixQrCode: r.pix_qr_code, pixCopyPaste: r.pix_copy_paste, createdAt: r.created_at, paidAt: r.paid_at }; }

export const db = {
  // ---- Settings ----
  async ensureSettings(userId: string, name: string): Promise<void> {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await supabase.from('restaurant_settings').upsert({
      user_id: userId, name, slug, accent_color: '#059669', description: '', address: '', phone: '', logo_url: '', cover_url: '',
      xgate_email: '', xgate_password: '', payment_methods: ['pix', 'cash'],
      whatsapp_api_token: '', whatsapp_phone_number_id: '', whatsapp_enabled: false,
    }, { onConflict: 'user_id', ignoreDuplicates: true });
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

  async updateCategory(id: string, updates: Partial<Pick<Category, 'name' | 'emoji' | 'order'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.emoji !== undefined) row.emoji = updates.emoji;
    if (updates.order !== undefined) row.order = updates.order;
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
    const { data, error } = await supabase.from('menu_items').insert({ user_id: userId, category_id: item.categoryId, name: item.name, description: item.description, emoji: item.emoji, image_url: item.imageUrl ?? '', price: item.price, available: item.available, order: maxOrder + 1 }).select().single();
    if (error) throw error;
    return toMenuItem(data as MenuItemRow);
  },

  async updateMenuItem(id: string, updates: Partial<Pick<MenuItem, 'name' | 'description' | 'price' | 'emoji' | 'imageUrl' | 'available' | 'categoryId' | 'order'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.price !== undefined) row.price = updates.price;
    if (updates.emoji !== undefined) row.emoji = updates.emoji;
    if (updates.imageUrl !== undefined) row.image_url = updates.imageUrl;
    if (updates.available !== undefined) row.available = updates.available;
    if (updates.categoryId !== undefined) row.category_id = updates.categoryId;
    if (updates.order !== undefined) row.order = updates.order;
    await supabase.from('menu_items').update(row).eq('id', id);
  },

  async deleteMenuItem(id: string): Promise<void> {
    await supabase.from('menu_items').delete().eq('id', id);
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
      supabase.from('menu_items').select('*').eq('user_id', settings.userId).eq('available', true).order('order', { ascending: true }),
    ]);
    return { settings, categories: (catsData as CategoryRow[] || []).map(toCategory), items: (itemsData as MenuItemRow[] || []).map(toMenuItem) };
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
      items: order.items, total: order.total, status: order.status,
      customer_name: order.customerName, customer_phone: order.customerPhone,
      payment_method: order.paymentMethod, delivery_address: order.deliveryAddress,
      delivery_type: order.deliveryType, pix_tx_id: order.pixTxId,
      pix_qr_code: order.pixQrCode, pix_copy_paste: order.pixCopyPaste, paid_at: order.paidAt,
    };
    const row = order.customerUserId ? { ...baseRow, customer_user_id: order.customerUserId } : baseRow;
    const { data, error } = await supabase.from('orders').insert(row).select().single();
    // If the column doesn't exist yet (migration not run), retry without it
    if (error?.message?.includes('customer_user_id')) {
      const { data: d2, error: e2 } = await supabase.from('orders').insert(baseRow).select().single();
      if (e2) throw new Error(e2.message || JSON.stringify(e2));
      return toOrder(d2 as OrderRow);
    }
    if (error) throw new Error(error.message || JSON.stringify(error));
    return toOrder(data as OrderRow);
  },

  async updateOrder(id: string, updates: Partial<Pick<Order, 'status' | 'paidAt'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.paidAt !== undefined) row.paid_at = updates.paidAt;
    await supabase.from('orders').update(row).eq('id', id);
  },
};
