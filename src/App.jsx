import { useEffect, useMemo, useState } from 'react'

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
}

function CategoryTabs({ categories, active, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {['All', ...categories].map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
            active === c ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

function MenuCard({ item, onAdd }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col">
      {item.image_url && (
        <img src={item.image_url} alt={item.name} className="w-full h-36 object-cover rounded-lg mb-3" />
      )}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
          <span className="text-blue-600 font-semibold">{formatCurrency(item.price)}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
      </div>
      <button
        onClick={() => onAdd(item)}
        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-medium transition"
      >
        Add to Order
      </button>
    </div>
  )
}

function Cart({ items, onInc, onDec, onCheckout }) {
  const subtotal = useMemo(() => items.reduce((s, it) => s + it.unit_price * it.quantity, 0), [items])
  const tax = useMemo(() => Math.round(subtotal * 0.08 * 100) / 100, [subtotal])
  const total = useMemo(() => Math.round((subtotal + tax) * 100) / 100, [subtotal, tax])

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 sticky top-4">
      <h3 className="text-xl font-semibold mb-4">Your Order</h3>
      {items.length === 0 ? (
        <p className="text-gray-500">Your cart is empty.</p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.menu_item_id} className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-gray-800">{it.name}</p>
                <p className="text-sm text-gray-500">{formatCurrency(it.unit_price)} × {it.quantity}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onDec(it.menu_item_id)} className="w-8 h-8 rounded-full border">-</button>
                <span className="w-6 text-center">{it.quantity}</span>
                <button onClick={() => onInc(it.menu_item_id)} className="w-8 h-8 rounded-full border">+</button>
              </div>
            </div>
          ))}
          <div className="pt-3 border-t space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{formatCurrency(tax)}</span></div>
            <div className="flex justify-between font-semibold text-gray-800"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
          <button onClick={onCheckout} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 font-medium">Checkout</button>
        </div>
      )}
    </div>
  )
}

function App() {
  const [menu, setMenu] = useState([])
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Try to fetch menu; if empty, seed then refetch
        let res = await fetch(`${backend}/api/menu`)
        if (!res.ok) throw new Error('Failed to load menu')
        let data = await res.json()
        if (data.length === 0) {
          await fetch(`${backend}/api/menu/seed`, { method: 'POST' })
          res = await fetch(`${backend}/api/menu`)
          data = await res.json()
        }
        setMenu(data)
      } catch (e) {
        setMessage(`Could not load menu: ${e.message}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const categories = useMemo(() => Array.from(new Set(menu.map(m => m.category))), [menu])
  const filtered = useMemo(
    () => (category === 'All' ? menu : menu.filter(m => m.category === category)),
    [menu, category]
  )

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find(p => p.menu_item_id === item._id || p.menu_item_id === item.id || p.menu_item_id === item.name)
      // use name as fallback id when not available in response_model
      const key = item._id || item.id || item.name
      if (existing) {
        return prev.map(p => p.menu_item_id === existing.menu_item_id ? { ...p, quantity: p.quantity + 1 } : p)
      }
      return [
        ...prev,
        {
          menu_item_id: key,
          name: item.name,
          unit_price: item.price,
          quantity: 1,
        },
      ]
    })
  }

  const inc = (id) => setCart((prev) => prev.map(p => p.menu_item_id === id ? { ...p, quantity: p.quantity + 1 } : p))
  const dec = (id) => setCart((prev) => prev.flatMap(p => p.menu_item_id === id ? (p.quantity > 1 ? [{ ...p, quantity: p.quantity - 1 }] : []) : [p]))

  const checkout = async () => {
    if (cart.length === 0) return
    setMessage('Placing your order...')
    try {
      const payload = {
        customer: { name: 'Guest' },
        items: cart,
        pickup: false,
      }
      const res = await fetch(`${backend}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Checkout failed')
      const data = await res.json()
      setCart([])
      setMessage(`Order placed! Total ${formatCurrency(data.total)}. Order ID: ${data.id}`)
    } catch (e) {
      setMessage(`Could not place order: ${e.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-amber-50">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">BlueBite Bistro</h1>
          <a href="/test" className="text-sm text-blue-700 underline">System Test</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Menu</h2>
            <CategoryTabs categories={categories} active={category} onChange={setCategory} />
          </div>

          {loading ? (
            <p className="text-gray-600">Loading menu...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((item) => (
                <MenuCard key={item.name} item={item} onAdd={addToCart} />
              ))}
            </div>
          )}
        </div>

        <div>
          <Cart items={cart} onInc={inc} onDec={dec} onCheckout={checkout} />
          {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
        </div>
      </main>
    </div>
  )
}

export default App
