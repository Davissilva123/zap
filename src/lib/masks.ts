// Brazilian phone mask: (XX) XXXXX-XXXX (mobile) or (XX) XXXX-XXXX (landline)
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Currency mask while typing: digits → R$ X.XXX,XX
export function maskCurrency(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  if (cents === 0) return '';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Parse masked currency string to number
export function parseCurrency(value: string): number {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

// Convert a number to currency display string for input value
export function numToCurrency(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '' || n === 0) return '';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
