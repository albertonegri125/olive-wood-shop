// src/pages/AdminCategories.jsx
//
// Sezione "Categorie" del pannello admin (/admin/categorie, protetta da
// RequireAdmin): CRUD completo sulle categorie prodotto, senza dover
// passare dal SQL Editor di Supabase.
//
// A differenza di "Gestione Admin" (is_admin, dato critico di sicurezza
// che passa SEMPRE dalla Edge Function manage-admin), qui operiamo con
// query dirette a Supabase: le categorie sono un dato "normale" di
// catalogo, già protetto a sufficienza dalla policy RLS esistente
// ("Gli admin possono gestire le categorie", schema_categories.sql), che
// limita insert/update/delete a chi ha is_admin = true — non serve
// nessuna verifica aggiuntiva lato server per un'operazione di questo
// tipo (diversamente da is_admin, un errore qui non "apre" nessun altro
// varco di sicurezza).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { slugify } from '../lib/slugify'
import AdminNav from '../components/AdminNav'
import '../pages/Auth.css'
import './Admin.css'
import './AdminCategories.css'

function logSupabaseError(context, error) {
  console.error(`[AdminCategories] ${context}:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  })
}

const EMPTY_FORM = { nameIt: '', nameEn: '', slug: '' }

function AdminCategories() {
  const { t } = useTranslation()

  // --- Lista categorie (con conteggio prodotti collegati) -----------------
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(null)

  async function fetchCategories() {
    setLoading(true)
    setListError(null)

    // "products(count)" sfrutta la relazione (products.category_id ->
    // categories.id) per farsi restituire anche il numero di prodotti
    // collegati a ciascuna categoria in un'unica query, senza doverli
    // scaricare tutti e contarli lato client.
    const { data, error } = await supabase
      .from('categories')
      .select('*, products(count)')
      .order('created_at')

    if (error) {
      logSupabaseError('Errore nel caricare le categorie', error)
      setListError(t('adminCategories.error'))
    } else {
      setCategories(
        (data ?? []).map((category) => ({
          ...category,
          productsCount: category.products?.[0]?.count ?? 0,
        }))
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    void fetchCategories()
  }, [])

  // --- Form di creazione/modifica ------------------------------------------
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // true dopo la prima modifica manuale dello slug: da quel momento non lo
  // rigeneriamo più automaticamente digitando il nome (stessa logica del
  // form prodotto in Admin.jsx).
  const [slugEditedManually, setSlugEditedManually] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  function openNewForm() {
    setEditingCategory(null)
    setForm(EMPTY_FORM)
    setSlugEditedManually(false)
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(category) {
    setEditingCategory(category)
    setForm({
      nameIt: category.name ?? '',
      nameEn: category.name_en ?? '',
      slug: category.slug ?? '',
    })
    // In modifica lo slug è già "manuale": ritoccare il nome non deve
    // cambiare di nascosto l'URL/il filtro già eventualmente condiviso
    // (es. link "/shop?category=slug").
    setSlugEditedManually(true)
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingCategory(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  function handleNameItChange(event) {
    const nameIt = event.target.value
    setForm((current) => ({
      ...current,
      nameIt,
      slug: slugEditedManually ? current.slug : slugify(nameIt),
    }))
  }

  function handleSlugChange(event) {
    setSlugEditedManually(true)
    setForm((current) => ({ ...current, slug: event.target.value }))
  }

  function handleNameEnChange(event) {
    const nameEn = event.target.value
    setForm((current) => ({ ...current, nameEn }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!form.nameIt.trim() || !form.slug.trim()) {
      setFormError(t('adminCategories.form.requiredFields'))
      return
    }

    setSaving(true)
    setFormError(null)

    const payload = {
      name: form.nameIt.trim(),
      name_en: form.nameEn.trim() || null,
      slug: form.slug.trim(),
    }

    const { error } = editingCategory
      ? await supabase.from('categories').update(payload).eq('id', editingCategory.id)
      : await supabase.from('categories').insert(payload)

    setSaving(false)

    if (error) {
      logSupabaseError(
        editingCategory ? 'Errore nel modificare la categoria' : 'Errore nel creare la categoria',
        error
      )
      // Codice Postgres per violazione di un vincolo "unique" (slug).
      setFormError(error.code === '23505' ? t('adminCategories.form.slugInUse') : t('adminCategories.form.saveError'))
      return
    }

    closeForm()
    void fetchCategories()
  }

  // --- Eliminazione categoria -----------------------------------------------
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  async function handleDelete(category) {
    // Avviso esplicito e diverso a seconda che ci siano prodotti collegati:
    // eliminare la categoria NON li elimina né fallisce con un errore SQL
    // (la colonna products.category_id è "on delete set null", vedi
    // schema_categories.sql) — restano semplicemente senza categoria.
    // Meglio dirlo chiaramente PRIMA di procedere che lasciarlo scoprire
    // dopo.
    const confirmMessage =
      category.productsCount > 0
        ? t('adminCategories.confirmDeleteWithProducts', {
            name: category.name,
            count: category.productsCount,
          })
        : t('adminCategories.confirmDelete', { name: category.name })

    if (!window.confirm(confirmMessage)) return

    setPendingDeleteId(category.id)

    const { error } = await supabase.from('categories').delete().eq('id', category.id)

    setPendingDeleteId(null)

    if (error) {
      logSupabaseError(`Errore nell'eliminare la categoria ${category.id}`, error)
      window.alert(t('adminCategories.deleteError'))
      return
    }

    setCategories((current) => current.filter((item) => item.id !== category.id))
  }

  return (
    <div className="admin-page">
      <AdminNav />

      <div className="admin-header">
        <h1 className="admin-title">{t('adminCategories.title')}</h1>
        <button type="button" className="btn-primary" onClick={openNewForm}>
          {t('adminCategories.form.add')}
        </button>
      </div>

      {showForm && (
        <div className="admin-form-panel">
          <h2>{editingCategory ? t('adminCategories.form.editTitle') : t('adminCategories.form.newTitle')}</h2>

          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="admin-form-row">
              <div className="auth-field">
                <label className="auth-label" htmlFor="admin-category-name-it">
                  {t('adminCategories.form.nameLabel')}
                </label>
                <input
                  id="admin-category-name-it"
                  className="auth-input"
                  value={form.nameIt}
                  onChange={handleNameItChange}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="admin-category-name-en">
                  {t('adminCategories.form.nameEnLabel')}
                </label>
                <input
                  id="admin-category-name-en"
                  className="auth-input"
                  value={form.nameEn}
                  onChange={handleNameEnChange}
                />
              </div>
            </div>

            <p className="admin-form-hint">{t('adminCategories.form.nameEnHint')}</p>

            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-category-slug">
                {t('adminCategories.form.slugLabel')}
              </label>
              <input
                id="admin-category-slug"
                className="auth-input"
                value={form.slug}
                onChange={handleSlugChange}
                required
              />
            </div>

            {formError && <p className="auth-error">{formError}</p>}

            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('adminCategories.form.saving') : t('adminCategories.form.save')}
              </button>
              <button type="button" className="btn-secondary" onClick={closeForm}>
                {t('adminCategories.form.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p className="admin-message">{t('adminCategories.loading')}</p>}
      {!loading && listError && <p className="admin-message">{listError}</p>}
      {!loading && !listError && categories.length === 0 && (
        <p className="admin-message">{t('adminCategories.empty')}</p>
      )}

      {!loading && !listError && categories.length > 0 && (
        <div className="admin-table-wrapper">
          <div className="admin-categories-table" role="table">
            <div className="admin-table-row" role="row">
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('adminCategories.table.name')}
              </span>
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('adminCategories.table.nameEn')}
              </span>
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('adminCategories.table.slug')}
              </span>
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('adminCategories.table.products')}
              </span>
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('adminCategories.table.actions')}
              </span>
            </div>

            {categories.map((category) => (
              <div className="admin-table-row" role="row" key={category.id}>
                <div className="admin-table-cell" role="cell">
                  {category.name}
                </div>
                <div className="admin-table-cell" role="cell">
                  {category.name_en || <span className="admin-message">—</span>}
                </div>
                <div className="admin-table-cell" role="cell">
                  <code className="admin-categories-slug">{category.slug}</code>
                </div>
                <div className="admin-table-cell" role="cell">
                  {category.productsCount}
                </div>
                <div className="admin-table-cell admin-table-cell-actions" role="cell">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => openEditForm(category)}>
                    {t('adminCategories.table.edit')}
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={pendingDeleteId === category.id}
                    onClick={() => handleDelete(category)}
                  >
                    {t('adminCategories.table.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminCategories
