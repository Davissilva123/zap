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
  createdAt: string;
}

export interface MenuItem {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  available: boolean;
  order: number;
  createdAt: string;
}

export interface Scan {
  id: string;
  userId: string;
  scannedAt: string;
}

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'meal_voucher';

export interface RestaurantSettings {
  userId: string;
  name: string;
  slug: string;
  accentColor: string;
  description: string;
  address: string;
  phone: string;
  logoUrl: string;
  xgateEmail: string;
  xgatePassword: string;
  paymentMethods: PaymentMethod[];
  whatsappApiToken: string;
  whatsappPhoneNumberId: string;
  whatsappEnabled: boolean;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  emoji: string;
  price: number;
  quantity: number;
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
  items: OrderItem[];
  total: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'PREPARING' | 'DELIVERING' | 'COMPLETED';
  customerName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  deliveryAddress: DeliveryAddress | null;
  deliveryType: 'pickup' | 'delivery';
  pixTxId: string;
  pixQrCode: string;
  pixCopyPaste: string;
  createdAt: string;
  paidAt: string | null;
}
