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
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'PREPARING' | 'DELIVERING' | 'COMPLETED';
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
