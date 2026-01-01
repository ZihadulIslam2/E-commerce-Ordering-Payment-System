export const generateOrderNumber = (): string => {
  return `ORD-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)
    .toUpperCase()}`
}

export const formatPrice = (price: number): string => {
  return `$${price.toFixed(2)}`
}

export const calculateTotal = (
  items: Array<{ price: number; quantity: number }>
): number => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0)
}
