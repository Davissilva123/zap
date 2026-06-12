export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  order: number;
  availableFrom?: string;
  availableTo?: string;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  promoPrice?: number;
  emoji: string;
  imageUrl: string;
  available: boolean;
  featured?: boolean;
  stock?: number | null;
  cost?: number;
  order: number;
  createdAt: string;
}

export interface ItemOption {
  id: string;
  groupId: string;
  userId: string;
  name: string;
  priceDelta: number;
  order: number;
}

export interface ItemGroup {
  id: string;
  menuItemId: string;
  userId: string;
  name: string;
  required: boolean;
  minChoices: number;
  maxChoices: number;
  order: number;
  options: ItemOption[];
}

export interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface Scan {
  id: string;
  userId: string;
  scannedAt: string;
}

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'meal_voucher';

export interface DayHours {
  open: boolean;
  from: string;
  to: string;
}

export type OpeningHours = Record<string, DayHours>; // key = "0"–"6" (0=domingo)

export interface DeliveryNeighborhood {
  name: string;
  fee: number;
}

export interface RestaurantSettings {
  userId: string;
  mercadoPagoToken: string;
  name: string;
  slug: string;
  accentColor: string;
  description: string;
  address: string;
  phone: string;
  logoUrl: string;
  coverUrl: string;
  xgateEmail: string;
  xgatePassword: string;
  paymentMethods: PaymentMethod[];
  whatsappApiToken: string;
  whatsappPhoneNumberId: string;
  whatsappEnabled: boolean;
  openingHours: OpeningHours;
  deliveryTime: string;
  deliveryFee: number;
  deliveryNeighborhoods: DeliveryNeighborhood[];
  loyaltyEnabled: boolean;
  loyaltyOrdersNeeded: number;
  loyaltyReward: string;
  cashbackPercent: number;
  minimumOrder: number;
  manualClosed: boolean;
  waiterDiscountEnabled: boolean;
  blocked?: boolean;
  blockedReason?: string;
  disabled?: boolean;
  disabledReason?: string | null;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  emoji: string;
  price: number;
  quantity: number;
  selectedOptions?: SelectedOption[];
}

export interface DeliveryAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
}

export interface Order {
  id: string;
  userId: string;
  customerUserId?: string;
  items: OrderItem[];
  total: number;
  discount: number;
  couponCode?: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'PREPARING' | 'READY' | 'DELIVERING' | 'COMPLETED';
  customerName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  deliveryAddress: DeliveryAddress | null;
  deliveryType: 'pickup' | 'delivery' | 'table';
  tableName?: string;
  notes?: string;
  driverName?: string;
  driverId?: string;
  pixTxId: string;
  pixQrCode: string;
  pixCopyPaste: string;
  rating?: number;
  ratingComment?: string;
  scheduledFor?: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface Driver {
  id: string;
  userId: string;
  name: string;
  phone: string;
  active: boolean;
  accessToken: string;
  lat?: number | null;
  lng?: number | null;
  lastLocationAt?: string | null;
  createdAt: string;
}

export interface Coupon {
  id: string;
  userId: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrder: number;
  maxUses: number | null;
  usesCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface RestaurantTable {
  id: string;
  userId: string;
  name: string;
  order: number;
  active: boolean;
  createdAt: string;
}

export interface Branch {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

export interface Operator {
  id: string;
  ownerId: string;
  email: string;
  name: string;
  role: 'admin' | 'waiter' | 'cashier' | 'kitchen';
  active: boolean;
  notes: string;
  createdAt: string;
  userId?: string | null;
}

export interface ComboItem {
  menuItemId: string;
  name: string;
  emoji: string;
  quantity: number;
}

export interface Combo {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  active: boolean;
  items: ComboItem[];
  createdAt: string;
}

export interface Promotion {
  id: string;
  userId: string;
  name: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  discountPercent: number;
  targetType: 'all' | 'category' | 'item';
  targetId: string | null;
  active: boolean;
  createdAt: string;
}

export interface CashSession {
  id: string;
  userId: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  totalSales: number;
  totalWithdrawals: number;
  totalDeposits: number;
  status: 'open' | 'closed';
  notes: string;
  createdAt: string;
}

export interface CashEntry {
  id: string;
  sessionId: string;
  userId: string;
  type: 'sale' | 'withdrawal' | 'deposit';
  amount: number;
  description: string;
  createdAt: string;
}

export interface CustomerRecord {
  phone: string;
  name: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
  segment: 'loyal' | 'active' | 'at_risk' | 'inactive';
}

export interface Supplier {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  cnpj: string;
  address: string;
  contactName: string;
  notes: string;
  active: boolean;
  createdAt: string;
}

export interface RecipeIngredient {
  id: string;
  userId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  supplierId: string | null;
  createdAt: string;
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  orderId: string;
  userId: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  userId: string;
  supplierId: string | null;
  supplierName?: string;
  status: PurchaseOrderStatus;
  expectedDate: string | null;
  receivedDate: string | null;
  total: number;
  notes: string;
  items?: PurchaseOrderItem[];
  createdAt: string;
}

export type FinancialEntryType = 'payable' | 'receivable';
export type FinancialEntryStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type FinancialEntryRecurrence = 'none' | 'monthly' | 'weekly' | 'yearly';

export interface FinancialEntry {
  id: string;
  userId: string;
  type: FinancialEntryType;
  description: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: FinancialEntryStatus;
  category: string;
  supplierId: string | null;
  notes: string;
  recurrence: FinancialEntryRecurrence;
  createdAt: string;
}
