import { useEffect, useMemo, useState } from 'react'
import { ChefHat, Martini, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatMoney } from '../../lib/format.js'
import { inputClass } from '../../components/ui.jsx'
import { Button, EmptyState, PageHeader, Toggle } from '../../components/staff.jsx'

const emptyForm = { name: '', description: '', price: '', category: '', photo_url: '', station: 'kitchen', available: true }

const fold = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function StationChip({ station }) {
  const bar = station === 'bar'
  const Icon = bar ? Martini : ChefHat
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sea-950/[0.06] px-2 py-0.5 text-xs font-bold text-sea-950/70">
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {bar ? 'Bar' : 'Cocina'}
    </span>
  )
}

function ItemEditor({ item, categories, onClose, onSaved, onDeleted, restaurantId }) {
  const isNew = !item?.id
  const [form, setForm] = useState(() =>
    isNew ? emptyForm : { ...emptyForm, ...item, price: String(item.price), description: item.description || '', category: item.category || '', photo_url: item.photo_url || '' },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setError(null)
    const price = Number(form.price)
    if (!form.name.trim()) return setError('Escribe el nombre del platillo.')
    if (!Number.isFinite(price) || price < 0) return setError('Escribe un precio válido, por ejemplo 120 o 95.50.')
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      category: form.category.trim() || null,
      photo_url: form.photo_url.trim() || null,
      station: form.station,
      available: form.available,
    }
    const { data, error: saveError } = isNew
      ? await supabase.from('menu_items').insert({ ...payload, restaurant_id: restaurantId }).select().single()
      : await supabase.from('menu_items').update(payload).eq('id', item.id).select().single()
    setSaving(false)
    if (saveError) return setError('No se pudo guardar. Revisa los datos e intenta de nuevo.')
    onSaved(data, isNew)
  }

  const remove = async () => {
    if (!window.confirm(`¿Eliminar "${item.name}" del menú? Si solo se acabó por hoy, mejor márcalo como agotado.`)) return
    setSaving(true)
    const { error: deleteError } = await supabase.from('menu_items').delete().eq('id', item.id)
    setSaving(false)
    if (deleteError) return setError('No se pudo eliminar. Intenta de nuevo.')
    onDeleted(item.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/60 sm:items-center sm:p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Agregar platillo' : `Editar ${item.name}`}
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-salt p-5 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="condensed text-3xl font-extrabold">{isNew ? 'Nuevo platillo' : 'Editar platillo'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full hover:bg-sea-950/5">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Nombre</span>
              <input required value={form.name} onChange={set('name')} className={inputClass} autoFocus={isNew} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Precio</span>
              <input required inputMode="decimal" value={form.price} onChange={set('price')} placeholder="0" className={`${inputClass} tabular-nums`} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Categoría</span>
            <input list="menu-categories" value={form.category} onChange={set('category')} placeholder="Ej. Tacos, Cocteles, Bebidas" className={inputClass} />
            <datalist id="menu-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Descripción <span className="font-normal text-sea-950/50">opcional</span></span>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Ingredientes o cómo se sirve" className={`${inputClass} h-auto py-3`} />
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-semibold">¿Quién lo prepara?</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'kitchen', label: 'Cocina', icon: ChefHat },
                { value: 'bar', label: 'Bar', icon: Martini },
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, station: o.value }))}
                  aria-pressed={form.station === o.value}
                  className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
                    form.station === o.value ? 'bg-sea-950 text-white' : 'bg-white ring-1 ring-sea-950/15'
                  }`}
                >
                  <o.icon size={17} strokeWidth={2.25} aria-hidden="true" />
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Foto <span className="font-normal text-sea-950/50">enlace a la imagen, opcional</span></span>
            <input type="url" value={form.photo_url} onChange={set('photo_url')} placeholder="https://…" className={inputClass} />
          </label>
          <div className="rounded-xl bg-white p-3.5 ring-1 ring-sea-950/10">
            <Toggle
              checked={form.available}
              onChange={(v) => setForm((f) => ({ ...f, available: v }))}
              label="Disponible"
              sub="Apágalo cuando se acabe; los clientes lo verán como agotado."
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-chili-500/10 px-3.5 py-3 text-sm font-semibold text-chili-500">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          {!isNew && (
            <Button tone="danger" size="lg" onClick={remove} disabled={saving} aria-label="Eliminar platillo">
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" disabled={saving}>
            {saving ? 'Guardando…' : isNew ? 'Agregar al menú' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function MenuPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (new) | item
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', profile.restaurant_id)
      .order('category', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError('No pudimos cargar el menú.')
        setItems(data || [])
        setLoading(false)
      })
  }, [profile.restaurant_id])

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items])

  const grouped = useMemo(() => {
    const q = fold(query.trim())
    const groups = new Map()
    for (const item of items) {
      if (q && !fold(item.name).includes(q) && !fold(item.category).includes(q)) continue
      const key = item.category || 'Sin categoría'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }
    // Same order customers see: food first, drinks and desserts last.
    const last = (name) => (/bebida|drink|postre|dessert|café|cafe|coffee/i.test(name) ? 1 : 0)
    return [...groups.entries()].sort((a, b) => last(a[0]) - last(b[0]))
  }, [items, query])

  const toggleAvailable = async (item, available) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available } : i)))
    const { error: updateError } = await supabase.from('menu_items').update({ available }).eq('id', item.id)
    if (updateError) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: !available } : i)))
      setError(`No se pudo cambiar "${item.name}". Intenta de nuevo.`)
    }
  }

  const soldOut = items.filter((i) => !i.available).length

  return (
    <div>
      <PageHeader
        title="Menú"
        sub={loading ? ' ' : `${items.length} platillos${soldOut ? ` · ${soldOut} agotados` : ''}`}
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus size={18} strokeWidth={2.75} aria-hidden="true" />
            Agregar platillo
          </Button>
        }
      />

      <label className="mb-5 flex h-12 items-center gap-3 rounded-xl bg-white px-3.5 ring-1 ring-sea-950/15 focus-within:ring-2 focus-within:ring-sun-500">
        <Search size={18} className="text-sea-950/45" aria-hidden="true" />
        <span className="sr-only">Buscar en el menú</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar platillo o categoría"
          className="h-full w-full bg-transparent text-base focus:outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-chili-500/10 px-3.5 py-3 text-sm font-semibold text-chili-500">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-sea-950/[0.06]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Tu menú está vacío">Agrega tu primer platillo. Los clientes lo verán en cuanto lo guardes.</EmptyState>
      ) : grouped.length === 0 ? (
        <EmptyState title="Nada coincide">Prueba con otra palabra.</EmptyState>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, list]) => (
            <section key={category}>
              <h2 className="condensed mb-2 text-2xl font-extrabold">{category}</h2>
              <ul className="divide-y divide-sea-950/10 overflow-hidden rounded-2xl bg-white ring-1 ring-sea-950/10">
                {list.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => setEditing(item)} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
                      {item.photo_url && <img src={item.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
                      <span className="min-w-0">
                        <span className={`flex items-center gap-2 font-bold ${item.available ? '' : 'text-sea-950/45 line-through'}`}>
                          <span className="truncate">{item.name}</span>
                          <Pencil size={14} className="shrink-0 text-sea-950/30 group-hover:text-sea-950" aria-hidden="true" />
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold tabular-nums">{formatMoney(item.price)}</span>
                          <StationChip station={item.station} />
                          {!item.available && <span className="text-xs font-bold text-chili-500">Agotado</span>}
                        </span>
                      </span>
                    </button>
                    <div className="w-[4.5rem] shrink-0">
                      <Toggle checked={item.available} onChange={(v) => toggleAvailable(item, v)} label={<span className="sr-only">Disponible: {item.name}</span>} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <ItemEditor
          item={editing}
          categories={categories}
          restaurantId={profile.restaurant_id}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setItems((prev) => (isNew ? [...prev, saved] : prev.map((i) => (i.id === saved.id ? saved : i))))
            setEditing(null)
          }}
          onDeleted={(id) => {
            setItems((prev) => prev.filter((i) => i.id !== id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

export default MenuPage
