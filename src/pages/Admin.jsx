// src/pages/Admin.jsx
//
// Pannello admin (/admin, protetto da RequireAdmin): permette di gestire il
// catalogo prodotti (creare, modificare, eliminare, aggiornare le scorte e
// caricare le foto) senza dover passare dalla dashboard di Supabase.
//
// - Lista di tutti i prodotti, con miniatura, nome, prezzo, scorte e azioni.
// - Le scorte si possono aggiornare direttamente dalla lista (input + bottone
//   "Salva" per riga), per le modifiche rapide più frequenti.
// - "Modifica" ed "Elimina" agiscono sulla riga corrispondente.
// - "Nuovo prodotto" apre lo stesso form usato per "Modifica" (vuoto).
// - Le immagini vengono caricate su Supabase Storage, nel bucket pubblico
//   "product-images" (vedi schema_admin.sql per crearlo e per le policy
//   di Row Level Security necessarie): dopo l'upload salviamo l'URL
//   pubblico nel campo "image_url" del prodotto.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
// Riusiamo gli stili dei campi di Auth.css (.auth-field, .auth-label,
// .auth-input, .auth-error): stesso aspetto dei form di Login/Registrazione,
// invece di ridefinire da capo gli stessi input anche qui.
import '../pages/Auth.css'
import './Admin.css'

// Trasforma il nome di un prodotto in uno slug "url-friendly"
// (es. "Tagliere Grande" -> "tagliere-grande"), rimuovendo accenti e
// caratteri non alfanumerici. Usata per pre-compilare lo slug quando si
// digita il nome in un nuovo prodotto.
function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rimuove i segni diacritici (es. à -> a)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Estrae il percorso del file all'interno del bucket da un URL pubblico di
// Supabase Storage (es. ".../object/public/product-images/foto.jpg" ->
// "foto.jpg"), usato per poter eliminare il file quando si elimina il
// prodotto collegato.
function getStoragePathFromPublicUrl(url) {
  if (!url) return null
  const marker = '/product-images/'
  const index = url.indexOf(marker)
  if (index === -1) return null
  return url.slice(index + marker.length)
}

// Stato iniziale (vuoto) del form, riusato sia per "Nuovo prodotto" sia
// per resettare il form dopo il salvataggio o l'annullamento.
const EMPTY_FORM = {
  name: '',
  slug: '',
  description: '',
  price: '',
  stock: '',
}

function Admin() {
  const { t } = useTranslation()

  // --- Lista prodotti -------------------------------------------------
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [listErrorKey, setListErrorKey] = useState(null)

  async function fetchProducts() {
    setLoadingProducts(true)
    setListErrorKey(null)

    const { data, error } = await supabase.from('products').select('*').order('created_at')

    if (error) {
      setListErrorKey('admin.error')
      console.error(error)
    } else {
      setProducts(data ?? [])
    }

    setLoadingProducts(false)
  }

  // "void" segnala esplicitamente che ignoriamo la Promise restituita:
  // fetchProducts() è definita fuori dall'effetto (sopra) perché viene
  // richiamata anche da altri punti della pagina (dopo un salvataggio o
  // un'eliminazione), non solo al primo caricamento.
  useEffect(() => {
    void fetchProducts()
  }, [])

  // --- Modifica rapida delle scorte dalla lista ------------------------
  // Valori digitati nell'input di ogni riga, tenuti separati dai prodotti
  // finché non si preme "Salva" (chiave: id prodotto, valore: stringa).
  const [stockDrafts, setStockDrafts] = useState({})
  // Id del prodotto il cui salvataggio scorte è in corso, per disabilitare
  // il bottone di quella riga soltanto (le altre restano utilizzabili).
  const [savingStockId, setSavingStockId] = useState(null)
  const [stockErrorId, setStockErrorId] = useState(null)

  function handleStockDraftChange(productId, value) {
    setStockDrafts((drafts) => ({ ...drafts, [productId]: value }))
  }

  async function handleSaveStock(product) {
    const draftValue = stockDrafts[product.id]
    const newStock = Number(draftValue)

    if (draftValue === undefined || draftValue === '' || Number.isNaN(newStock) || newStock < 0) {
      setStockErrorId(product.id)
      return
    }

    setSavingStockId(product.id)
    setStockErrorId(null)

    const { error } = await supabase.from('products').update({ stock: newStock }).eq('id', product.id)

    if (error) {
      console.error(error)
      setStockErrorId(product.id)
    } else {
      // Aggiorniamo il prodotto direttamente nell'elenco già in memoria,
      // invece di rifare una richiesta completa a Supabase: risposta
      // visiva immediata per una modifica pensata per essere veloce.
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, stock: newStock } : item))
      )
      setStockDrafts((drafts) => {
        const { [product.id]: _removed, ...rest } = drafts
        return rest
      })
    }

    setSavingStockId(null)
  }

  // --- Form di creazione/modifica ---------------------------------------
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // true dopo la prima modifica manuale dello slug: da quel momento non lo
  // rigeneriamo più automaticamente digitando il nome, per non sovrascrivere
  // una scelta fatta apposta dall'admin.
  const [slugEditedManually, setSlugEditedManually] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  // Anteprima dell'immagine: l'URL già salvato (in modifica) oppure
  // un object URL temporaneo generato dal file appena scelto.
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formErrorKey, setFormErrorKey] = useState(null)

  function openNewForm() {
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setSlugEditedManually(false)
    setImageFile(null)
    setImagePreviewUrl(null)
    setFormErrorKey(null)
    setShowForm(true)
  }

  function openEditForm(product) {
    setEditingProduct(product)
    setForm({
      name: product.name ?? '',
      slug: product.slug ?? '',
      description: product.description ?? '',
      price: String(product.price ?? ''),
      stock: String(product.stock ?? ''),
    })
    // In modifica consideriamo lo slug già "manuale": ritoccare il nome per
    // correggere un refuso non deve cambiare di nascosto l'URL del prodotto
    // (che potrebbe già essere stato condiviso).
    setSlugEditedManually(true)
    setImageFile(null)
    setImagePreviewUrl(product.image_url ?? null)
    setFormErrorKey(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreviewUrl(null)
    setFormErrorKey(null)
  }

  function handleNameChange(event) {
    const name = event.target.value
    setForm((current) => ({
      ...current,
      name,
      // Rigeneriamo lo slug dal nome solo se l'admin non lo ha ancora
      // toccato manualmente in questa sessione di modifica.
      slug: slugEditedManually ? current.slug : slugify(name),
    }))
  }

  function handleSlugChange(event) {
    setSlugEditedManually(true)
    setForm((current) => ({ ...current, slug: event.target.value }))
  }

  function handleFieldChange(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0] ?? null
    setImageFile(file)
    if (file) {
      setImagePreviewUrl(URL.createObjectURL(file))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const priceNumber = Number(form.price)
    const stockNumber = Number(form.stock)

    if (
      !form.name.trim() ||
      !form.slug.trim() ||
      form.price === '' ||
      Number.isNaN(priceNumber) ||
      priceNumber < 0 ||
      form.stock === '' ||
      Number.isNaN(stockNumber) ||
      stockNumber < 0
    ) {
      setFormErrorKey('admin.form.requiredFields')
      return
    }

    setSaving(true)
    setFormErrorKey(null)

    // URL immagine finale: quella già salvata sul prodotto (se in modifica
    // e non è stata scelta una nuova foto), altrimenti quella ottenuta
    // dall'upload appena sotto.
    let imageUrl = editingProduct?.image_url ?? null

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const filePath = `${form.slug}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile)

      if (uploadError) {
        console.error(uploadError)
        setFormErrorKey('admin.form.uploadError')
        setSaving(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('product-images').getPublicUrl(filePath)
      imageUrl = publicUrl
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      price: priceNumber,
      stock: stockNumber,
      image_url: imageUrl,
    }

    const { error } = editingProduct
      ? await supabase.from('products').update(payload).eq('id', editingProduct.id)
      : await supabase.from('products').insert(payload)

    if (error) {
      console.error(error)
      // Codice Postgres per violazione di un vincolo "unique" (qui, lo
      // slug, che nello schema è definito "unique"): messaggio dedicato
      // invece del generico "errore di salvataggio".
      setFormErrorKey(error.code === '23505' ? 'admin.form.slugInUse' : 'admin.form.saveError')
      setSaving(false)
      return
    }

    setSaving(false)
    closeForm()
    fetchProducts()
  }

  // --- Eliminazione prodotto ---------------------------------------------
  async function handleDelete(product) {
    const confirmed = window.confirm(t('admin.confirmDelete', { name: product.name }))
    if (!confirmed) return

    const { error } = await supabase.from('products').delete().eq('id', product.id)

    if (error) {
      console.error(error)
      window.alert(t('admin.deleteError'))
      return
    }

    // Proviamo a eliminare anche il file dell'immagine dal bucket, per non
    // lasciare foto "orfane" nello Storage. Se fallisce (es. immagine già
    // rimossa, o permessi) non blocchiamo comunque l'eliminazione del
    // prodotto, già andata a buon fine: registriamo solo l'errore.
    const storagePath = getStoragePathFromPublicUrl(product.image_url)
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('product-images')
        .remove([storagePath])
      if (storageError) {
        console.error(storageError)
      }
    }

    setProducts((current) => current.filter((item) => item.id !== product.id))
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">{t('admin.title')}</h1>
        <button type="button" className="btn-primary" onClick={openNewForm}>
          {t('admin.newProduct')}
        </button>
      </div>

      {/* --- Form di creazione/modifica, mostrato solo quando serve --- */}
      {showForm && (
        <div className="admin-form-panel">
          <h2>{editingProduct ? t('admin.form.editTitle') : t('admin.form.newTitle')}</h2>

          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-name">
                {t('admin.form.name')}
              </label>
              <input
                id="admin-name"
                className="auth-input"
                value={form.name}
                onChange={handleNameChange}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-slug">
                {t('admin.form.slug')}
              </label>
              <input
                id="admin-slug"
                className="auth-input"
                value={form.slug}
                onChange={handleSlugChange}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-description">
                {t('admin.form.description')}
              </label>
              <textarea
                id="admin-description"
                className="auth-input admin-textarea"
                rows={4}
                value={form.description}
                onChange={handleFieldChange('description')}
              />
            </div>

            <div className="admin-form-row">
              <div className="auth-field">
                <label className="auth-label" htmlFor="admin-price">
                  {t('admin.form.price')}
                </label>
                <input
                  id="admin-price"
                  className="auth-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleFieldChange('price')}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="admin-stock">
                  {t('admin.form.stock')}
                </label>
                <input
                  id="admin-stock"
                  className="auth-input"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={handleFieldChange('stock')}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-image">
                {t('admin.form.image')}
              </label>
              <input id="admin-image" type="file" accept="image/*" onChange={handleImageChange} />
              <p className="admin-form-hint">{t('admin.form.imageHint')}</p>
              {imagePreviewUrl && (
                <img className="admin-form-preview" src={imagePreviewUrl} alt="" />
              )}
            </div>

            {formErrorKey && <p className="auth-error">{t(formErrorKey)}</p>}

            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('admin.form.saving') : t('admin.form.save')}
              </button>
              <button type="button" className="btn-secondary" onClick={closeForm}>
                {t('admin.form.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- Lista prodotti --- */}
      {loadingProducts && <p className="admin-message">{t('admin.loading')}</p>}
      {!loadingProducts && listErrorKey && <p className="admin-message">{t(listErrorKey)}</p>}
      {!loadingProducts && !listErrorKey && products.length === 0 && (
        <p className="admin-message">{t('admin.empty')}</p>
      )}

      {!loadingProducts && !listErrorKey && products.length > 0 && (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-table-thumb-col">{t('admin.table.image')}</th>
                <th>{t('admin.table.name')}</th>
                <th>{t('admin.table.price')}</th>
                <th>{t('admin.table.stock')}</th>
                <th>{t('admin.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const formattedPrice = new Intl.NumberFormat('it-IT', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(product.price)
                const stockDraft = stockDrafts[product.id]

                return (
                  <tr key={product.id}>
                    <td>
                      {product.image_url ? (
                        <img
                          className="admin-table-thumb"
                          src={product.image_url}
                          alt={product.name}
                        />
                      ) : (
                        <span className="admin-table-thumb admin-table-thumb-empty" aria-hidden="true">
                          —
                        </span>
                      )}
                    </td>
                    <td>{product.name}</td>
                    <td>{formattedPrice}</td>
                    <td>
                      <div className="admin-stock-editor">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="admin-stock-input"
                          value={stockDraft ?? product.stock}
                          onChange={(event) => handleStockDraftChange(product.id, event.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={savingStockId === product.id || stockDraft === undefined}
                          onClick={() => handleSaveStock(product)}
                        >
                          {t('admin.table.saveStock')}
                        </button>
                      </div>
                      {stockErrorId === product.id && (
                        <p className="admin-stock-error">{t('admin.stockUpdateError')}</p>
                      )}
                    </td>
                    <td className="admin-table-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => openEditForm(product)}
                      >
                        {t('admin.table.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => handleDelete(product)}
                      >
                        {t('admin.table.delete')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Admin
