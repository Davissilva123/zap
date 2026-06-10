export type PlanSlug = 'basic' | 'pro' | 'premium' | '';

export type FeatureKey =
  | 'dashboard' | 'menu' | 'categories' | 'orders' | 'qrcode' | 'settings' | 'operators'
  | 'reports' | 'coupons' | 'tables'
  | 'reviews' | 'comandas' | 'drivers'
  | 'crm' | 'stock' | 'cashregister' | 'combos' | 'promotions'
  | 'campaigns';

const LEVEL: Record<PlanSlug, number> = { '': 0, basic: 1, pro: 2, premium: 3 };

export const FEATURE_MIN_PLAN: Record<FeatureKey, PlanSlug> = {
  // Básico
  dashboard:  'basic',
  menu:       'basic',
  categories: 'basic',
  orders:     'basic',
  qrcode:     'basic',
  settings:   'basic',
  operators:  'basic',
  // Pro
  reports:      'pro',
  coupons:      'pro',
  tables:       'pro',
  crm:          'pro',
  stock:        'pro',
  cashregister: 'pro',
  combos:       'pro',
  promotions:   'pro',
  // Premium
  reviews:      'premium',
  comandas:     'premium',
  drivers:      'premium',
  campaigns:    'premium',
};

export const PLAN_DISPLAY: Record<PlanSlug, string> = {
  '':       'Sem plano',
  basic:    'Básico',
  pro:      'Pro',
  premium:  'Premium',
};

export const PLAN_COLOR: Record<PlanSlug, string> = {
  '':       'slate',
  basic:    'slate',
  pro:      'emerald',
  premium:  'violet',
};

export function canAccess(userPlan: PlanSlug, feature: FeatureKey): boolean {
  return LEVEL[userPlan] >= LEVEL[FEATURE_MIN_PLAN[feature]];
}

export function requiredPlan(feature: FeatureKey): PlanSlug {
  return FEATURE_MIN_PLAN[feature];
}

// Quantidade máxima de operadores por plano (-1 = ilimitado)
export const OPERATOR_LIMIT: Record<PlanSlug, number> = {
  '':       0,
  basic:    2,
  pro:      5,
  premium:  -1,
};
