import type { User, Category, MenuItem, Scan, RestaurantSettings, Order } from './types';

const KEYS = {
  users: 'cardapio_users',
  categories: 'cardapio_categories',
  menuItems: 'cardapio_menu_items',
  scans: 'cardapio_scans',
  settings: 'cardapio_settings',
  currentUserId: 'cardapio_current_user',
  orders: 'cardapio_orders',
};

function read<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// Seed demo data
function seedIfEmpty() {
  const users = read<User>(KEYS.users);
  if (users.length > 0) return;

  const demoUser: User = {
    id: 'demo_user_1',
    name: 'João Silva',
    email: 'joao@exemplo.com',
    password: '123456',
    createdAt: new Date().toISOString(),
  };

  const categories: Category[] = [
    { id: 'cat_1', userId: demoUser.id, name: 'Entradas', emoji: '🥗', order: 0, createdAt: new Date().toISOString() },
    { id: 'cat_2', userId: demoUser.id, name: 'Pratos Principais', emoji: '🍽️', order: 1, createdAt: new Date().toISOString() },
    { id: 'cat_3', userId: demoUser.id, name: 'Sobremesas', emoji: '🍰', order: 2, createdAt: new Date().toISOString() },
    { id: 'cat_4', userId: demoUser.id, name: 'Bebidas', emoji: '🥤', order: 3, createdAt: new Date().toISOString() },
  ];

  const menuItems: MenuItem[] = [
    { id: 'item_1', userId: demoUser.id, categoryId: 'cat_1', name: 'Bruschetta', description: 'Pão italiano com tomate fresco, manjericão e azeite', price: 18.90, emoji: '🥖', available: true, order: 0, createdAt: new Date().toISOString() },
    { id: 'item_2', userId: demoUser.id, categoryId: 'cat_1', name: 'Salada Caesar', description: 'Alface romana, croutons, parmesão e molho caesar', price: 24.90, emoji: '🥗', available: true, order: 1, createdAt: new Date().toISOString() },
    { id: 'item_3', userId: demoUser.id, categoryId: 'cat_1', name: 'Carpaccio', description: 'Finas fatias de carne com rúcula, parmesão e alcaparras', price: 32.00, emoji: '🥩', available: false, order: 2, createdAt: new Date().toISOString() },
    { id: 'item_4', userId: demoUser.id, categoryId: 'cat_2', name: 'Risoto de Cogumelos', description: 'Arroz arbóreo cremoso com mix de cogumelos e trufa', price: 45.90, emoji: '🍚', available: true, order: 0, createdAt: new Date().toISOString() },
    { id: 'item_5', userId: demoUser.id, categoryId: 'cat_2', name: 'Salmão Grelhado', description: 'Filé de salmão com molho de manteiga e ervas, legumes assados', price: 58.90, emoji: '🐟', available: true, order: 1, createdAt: new Date().toISOString() },
    { id: 'item_6', userId: demoUser.id, categoryId: 'cat_2', name: 'Picanha na Brasa', description: 'Picanha grelhada com farofa, vinagrete e batata frita', price: 62.00, emoji: '🥩', available: true, order: 2, createdAt: new Date().toISOString() },
    { id: 'item_7', userId: demoUser.id, categoryId: 'cat_3', name: 'Petit Gâteau', description: 'Bolo de chocolate com centro derretido e sorvete de baunilha', price: 28.90, emoji: '🍫', available: true, order: 0, createdAt: new Date().toISOString() },
    { id: 'item_8', userId: demoUser.id, categoryId: 'cat_3', name: 'Tiramisu', description: 'Sobremesa italiana com mascarpone, café e cacau', price: 26.00, emoji: '🍰', available: true, order: 1, createdAt: new Date().toISOString() },
    { id: 'item_9', userId: demoUser.id, categoryId: 'cat_4', name: 'Suco Natural', description: 'Laranja, limão, abacaxi ou maracujá', price: 12.90, emoji: '🍊', available: true, order: 0, createdAt: new Date().toISOString() },
    { id: 'item_10', userId: demoUser.id, categoryId: 'cat_4', name: 'Caipirinha', description: 'Cachaça, limão e açúcar — clássica brasileira', price: 22.00, emoji: '🍹', available: true, order: 1, createdAt: new Date().toISOString() },
  ];

  const scans: Scan[] = Array.from({ length: 14 }, (_, i) => ({
    id: genId(),
    userId: demoUser.id,
    scannedAt: new Date(Date.now() - (13 - i) * 86400000).toISOString(),
  }));

  const settings: RestaurantSettings = {
    userId: demoUser.id,
    name: 'Restaurante do João',
    slug: 'restaurante-do-joao',
    accentColor: '#059669',
    description: 'Cozinha contemporânea com ingredientes frescos e selecionados',
    address: 'Rua das Flores, 123 — São Paulo, SP',
    phone: '(11) 99999-0000',
    logoUrl: '',
    xgateEmail: '',
    xgatePassword: '',
    paymentMethods: ['pix', 'credit_card', 'debit_card', 'cash'],
    whatsappApiToken: '',
    whatsappPhoneNumberId: '',
    whatsappEnabled: false,
  };

  write(KEYS.users, [demoUser]);
  write(KEYS.categories, categories);
  write(KEYS.menuItems, menuItems);
  write(KEYS.scans, scans);
  write(KEYS.settings, [settings]);
}

seedIfEmpty();

// Migrate existing data for new fields
(function migrate() {
  const allSettings = read<RestaurantSettings>(KEYS.settings);
  let changed = false;
  allSettings.forEach((s, i) => {
    if (!s.paymentMethods) {
      allSettings[i].paymentMethods = ['pix', 'cash'];
      changed = true;
    }
    if (s.xgateEmail === undefined) {
      allSettings[i].xgateEmail = '';
      allSettings[i].xgatePassword = '';
      changed = true;
    }
    if (s.whatsappApiToken === undefined) {
      allSettings[i].whatsappApiToken = '';
      allSettings[i].whatsappPhoneNumberId = '';
      allSettings[i].whatsappEnabled = false;
      changed = true;
    }
  });
  if (changed) write(KEYS.settings, allSettings);

  const allOrders = read<Order>(KEYS.orders);
  let orderChanged = false;
  allOrders.forEach((o, i) => {
    if (!o.paymentMethod) {
      allOrders[i].paymentMethod = o.pixTxId ? 'pix' : 'cash';
      orderChanged = true;
    }
    if (!o.deliveryType) {
      allOrders[i].deliveryType = 'pickup';
      orderChanged = true;
    }
    if (o.deliveryAddress === undefined) {
      allOrders[i].deliveryAddress = null;
      orderChanged = true;
    }
  });
  if (orderChanged) write(KEYS.orders, allOrders);
})();

// Users
export const db = {
  // Auth
  login(email: string, password: string): User | null {
    const users = read<User>(KEYS.users);
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      localStorage.setItem(KEYS.currentUserId, user.id);
      return user;
    }
    return null;
  },

  register(name: string, email: string, password: string): User | null {
    const users = read<User>(KEYS.users);
    if (users.find(u => u.email === email)) return null;
    const user: User = { id: genId(), name, email, password, createdAt: new Date().toISOString() };
    users.push(user);
    write(KEYS.users, users);

    const settings: RestaurantSettings = {
      userId: user.id,
      name: name,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      accentColor: '#059669',
      description: '',
      address: '',
      phone: '',
      logoUrl: '',
      xgateEmail: '',
      xgatePassword: '',
      paymentMethods: ['pix', 'cash'],
      whatsappApiToken: '',
      whatsappPhoneNumberId: '',
      whatsappEnabled: false,
    };
    write(KEYS.settings, [...read<RestaurantSettings>(KEYS.settings), settings]);

    localStorage.setItem(KEYS.currentUserId, user.id);
    return user;
  },

  getCurrentUser(): User | null {
    const id = localStorage.getItem(KEYS.currentUserId);
    if (!id) return null;
    return read<User>(KEYS.users).find(u => u.id === id) || null;
  },

  logout() {
    localStorage.removeItem(KEYS.currentUserId);
  },

  ensureSettings(userId: string, name: string): void {
    if (db.getSettings(userId)) return;
    const settings: RestaurantSettings = {
      userId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      accentColor: '#059669',
      description: '',
      address: '',
      phone: '',
      logoUrl: '',
      xgateEmail: '',
      xgatePassword: '',
      paymentMethods: ['pix', 'cash'],
      whatsappApiToken: '',
      whatsappPhoneNumberId: '',
      whatsappEnabled: false,
    };
    write(KEYS.settings, [...read<RestaurantSettings>(KEYS.settings), settings]);
  },

  // Categories
  getCategories(userId: string): Category[] {
    return read<Category>(KEYS.categories).filter(c => c.userId === userId).sort((a, b) => a.order - b.order);
  },

  addCategory(userId: string, name: string, emoji: string): Category {
    const cats = read<Category>(KEYS.categories);
    const maxOrder = cats.filter(c => c.userId === userId).reduce((max, c) => Math.max(max, c.order), -1);
    const cat: Category = { id: genId(), userId, name, emoji, order: maxOrder + 1, createdAt: new Date().toISOString() };
    cats.push(cat);
    write(KEYS.categories, cats);
    return cat;
  },

  updateCategory(id: string, updates: Partial<Pick<Category, 'name' | 'emoji' | 'order'>>): Category | null {
    const cats = read<Category>(KEYS.categories);
    const idx = cats.findIndex(c => c.id === id);
    if (idx === -1) return null;
    Object.assign(cats[idx], updates);
    write(KEYS.categories, cats);
    return cats[idx];
  },

  deleteCategory(id: string): void {
    write(KEYS.categories, read<Category>(KEYS.categories).filter(c => c.id !== id));
    write(KEYS.menuItems, read<MenuItem>(KEYS.menuItems).filter(m => m.categoryId !== id));
  },

  // Menu Items
  getMenuItems(userId: string): MenuItem[] {
    return read<MenuItem>(KEYS.menuItems).filter(m => m.userId === userId).sort((a, b) => a.order - b.order);
  },

  addMenuItem(userId: string, item: Omit<MenuItem, 'id' | 'userId' | 'createdAt' | 'order'>): MenuItem {
    const items = read<MenuItem>(KEYS.menuItems);
    const maxOrder = items.filter(m => m.userId === userId).reduce((max, m) => Math.max(max, m.order), -1);
    const newItem: MenuItem = { ...item, id: genId(), userId, order: maxOrder + 1, createdAt: new Date().toISOString() };
    items.push(newItem);
    write(KEYS.menuItems, items);
    return newItem;
  },

  updateMenuItem(id: string, updates: Partial<Pick<MenuItem, 'name' | 'description' | 'price' | 'emoji' | 'available' | 'categoryId' | 'order'>>): MenuItem | null {
    const items = read<MenuItem>(KEYS.menuItems);
    const idx = items.findIndex(m => m.id === id);
    if (idx === -1) return null;
    Object.assign(items[idx], updates);
    write(KEYS.menuItems, items);
    return items[idx];
  },

  deleteMenuItem(id: string): void {
    write(KEYS.menuItems, read<MenuItem>(KEYS.menuItems).filter(m => m.id !== id));
  },

  // Scans
  getScans(userId: string): Scan[] {
    return read<Scan>(KEYS.scans).filter(s => s.userId === userId);
  },

  addScan(userId: string): Scan {
    const scans = read<Scan>(KEYS.scans);
    const scan: Scan = { id: genId(), userId, scannedAt: new Date().toISOString() };
    scans.push(scan);
    write(KEYS.scans, scans);
    return scan;
  },

  // Settings
  getSettings(userId: string): RestaurantSettings | null {
    return read<RestaurantSettings>(KEYS.settings).find(s => s.userId === userId) || null;
  },

  updateSettings(userId: string, updates: Partial<RestaurantSettings>): RestaurantSettings | null {
    const all = read<RestaurantSettings>(KEYS.settings);
    const idx = all.findIndex(s => s.userId === userId);
    if (idx === -1) return null;
    Object.assign(all[idx], updates);
    write(KEYS.settings, all);
    return all[idx];
  },

  // Public lookup
  getPublicMenu(slug: string): { settings: RestaurantSettings; categories: Category[]; items: MenuItem[] } | null {
    const settings = read<RestaurantSettings>(KEYS.settings).find(s => s.slug === slug);
    if (!settings) return null;
    return {
      settings,
      categories: db.getCategories(settings.userId),
      items: db.getMenuItems(settings.userId).filter(m => m.available),
    };
  },

  // Orders
  getOrders(userId: string): Order[] {
    return read<Order>(KEYS.orders).filter(o => o.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  addOrder(order: Omit<Order, 'id' | 'createdAt'>): Order {
    const orders = read<Order>(KEYS.orders);
    const newOrder: Order = { ...order, id: genId(), createdAt: new Date().toISOString() };
    orders.push(newOrder);
    write(KEYS.orders, orders);
    return newOrder;
  },

  updateOrder(id: string, updates: Partial<Pick<Order, 'status' | 'paidAt'>>): Order | null {
    const orders = read<Order>(KEYS.orders);
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    Object.assign(orders[idx], updates);
    write(KEYS.orders, orders);
    return orders[idx];
  },
};
