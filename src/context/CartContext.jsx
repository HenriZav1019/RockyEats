import { createContext, useContext, useEffect, useState } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'rockyeats_cart'
const emptyCart = { restaurantId: null, restaurantName: '', mode: null, items: [] }

function readStoredCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : emptyCart
  } catch {
    return emptyCart
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readStoredCart)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  const addItem = (restaurant, item) => {
    setCart((prev) => {
      if (prev.restaurantId && prev.restaurantId !== restaurant.id && prev.items.length > 0) {
        const proceed = window.confirm(
          `Your cart has items from ${prev.restaurantName}. Start a new order at ${restaurant.name} and clear the current cart?`,
        )
        if (!proceed) return prev
      }

      const sameRestaurant = prev.restaurantId === restaurant.id
      const existingItems = sameRestaurant ? prev.items : []
      const existing = existingItems.find((i) => i.id === item.id)

      const items = existing
        ? existingItems.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [
            ...existingItems,
            { id: item.id, name: item.name, price: item.price, quantity: 1, notes: '' },
          ]

      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        mode: sameRestaurant ? prev.mode : null,
        items,
      }
    })
  }

  const updateQuantity = (itemId, quantity) => {
    setCart((prev) => {
      if (quantity <= 0) {
        const items = prev.items.filter((i) => i.id !== itemId)
        return items.length === 0 ? emptyCart : { ...prev, items }
      }
      return { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)) }
    })
  }

  const updateNotes = (itemId, notes) =>
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, notes } : i)),
    }))

  const setMode = (mode) => setCart((prev) => ({ ...prev, mode }))

  const clearCart = () => setCart(emptyCart)

  const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider
      value={{ cart, addItem, updateQuantity, updateNotes, setMode, clearCart, total, itemCount }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
