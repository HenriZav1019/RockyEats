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

  // confirmSwitch(fromName, toName) -> boolean: asks before replacing a cart
  // from another restaurant (the caller supplies the translated prompt).
  const addItem = (restaurant, item, confirmSwitch) => {
    if (cart.restaurantId && cart.restaurantId !== restaurant.id && cart.items.length > 0) {
      const ask =
        confirmSwitch ||
        ((from, to) => window.confirm(`Your cart has items from ${from}. Start a new order at ${to}?`))
      if (!ask(cart.restaurantName, restaurant.name)) return
    }
    setCart((prev) => {
      const sameRestaurant = prev.restaurantId === restaurant.id
      const existingItems = sameRestaurant ? prev.items : []
      const existing = existingItems.find((i) => i.id === item.id)

      const items = existing
        ? existingItems.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [
            ...existingItems,
            { id: item.id, name: item.name, price: item.price, station: item.station || 'kitchen', quantity: 1, notes: '' },
          ]

      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        mode: !prev.restaurantId || sameRestaurant ? prev.mode : null,
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

  // Brings cart lines in line with the restaurant's current menu: updates
  // names/prices/stations and drops items that were removed or sold out.
  // Returns what changed so the UI can tell the customer.
  const syncWithMenu = (menuItems) => {
    const byId = new Map(menuItems.map((m) => [m.id, m]))
    const removed = []
    const repriced = []
    const items = []
    for (const line of cart.items) {
      const current = byId.get(line.id)
      if (!current || !current.available) {
        removed.push(line.name)
        continue
      }
      const price = Number(current.price)
      if (price !== Number(line.price)) repriced.push(current.name)
      items.push({ ...line, name: current.name, price, station: current.station || 'kitchen' })
    }
    const changed =
      removed.length > 0 ||
      items.some((i) => {
        const before = cart.items.find((b) => b.id === i.id)
        return before.name !== i.name || Number(before.price) !== i.price || before.station !== i.station
      })
    if (changed) {
      setCart((prev) => (items.length === 0 ? emptyCart : { ...prev, items }))
    }
    return { removed, repriced }
  }

  const setMode = (mode) => setCart((prev) => ({ ...prev, mode }))

  const clearCart = () => setCart(emptyCart)

  const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider
      value={{ cart, addItem, updateQuantity, updateNotes, syncWithMenu, setMode, clearCart, total, itemCount }}
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
