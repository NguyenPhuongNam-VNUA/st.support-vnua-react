export function currency(amount: number, options = {}) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options
  }).format(amount);
}
export function format(amount: number, options = {}) {
  return new Intl.NumberFormat('en-US', options).format(amount);
}
export function formatK(amount: number, style: any = 'currency') {
  if (amount < 1) return amount.toString();
  return new Intl.NumberFormat('en-US', {
    style: style as any,
    currency: 'USD',
    notation: 'compact',
    compactDisplay: 'short'
  }).format(amount);
}