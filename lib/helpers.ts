export function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0))
}
export function shortDate(value: string) {
  if (!value) return 'Not set'
  return new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}
export function errorMessage(value: string | undefined) {
  return value ? decodeURIComponent(value).slice(0, 250) : null
}
export const CATEGORIES = ['Bounce Houses', 'Photo Booths', 'Kids Furniture', 'Decorations', 'Entertainment', 'Event Planning']
