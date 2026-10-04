// src/pages/AdminReviews.jsx
//
// Sezione "Recensioni" del pannello admin (/admin/recensioni, protetta da
// RequireAdmin):
// - Recensioni in attesa (approved = false), con "Approva" (diventa
//   visibile sul sito) e "Rifiuta" (eliminata definitivamente).
// - Recensioni già approvate, eliminabili.
// - Form per aggiungere a mano una recensione (es. raccolta di persona o
//   via email), pubblicata subito o lasciata in attesa.
//
// Query dirette a Supabase, protette dalla policy "Gli admin possono
// gestire tutte le recensioni" già presente in schema_reviews.sql: nessuna
// migrazione nuova necessaria.
//
// Liste a "card" invece di una tabella: il testo di una recensione può
// essere lungo, e su mobile una card lo mostra per intero senza scroll
// orizzontale.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { formatDay } from '../lib/adminFormat'
import AdminNav from '../components/AdminNav'
import StarRating from '../components/StarRating'
import '../pages/Auth.css'
import './Admin.css'
import './AdminReviews.css'

function logSupabaseError(context, error) {
  console.error(`[AdminReviews] ${context}:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  })
}

const EMPTY_FORM = {
  customerName: '',
  productId: '',
  rating: '5',
  comment: '',
  approved: true,
}

const RATINGS = ['5', '4', '3', '2', '1']

function AdminReviews() {
  const { t } = useTranslation()

  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  // Id della recensione su cui è in corso un'azione (approva/elimina):
  // disabilita i suoi bottoni per evitare doppi click.
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(false)

  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formErrorKey, setFormErrorKey] = useState(null)
  const [savedNotice, setSavedNotice] = useState(false)

  async function fetchReviews() {
    setLoading(true)
    setListError(false)

    const { data, error } = await supabase
      .from('reviews')
      .select('*, products(name, slug)')
      .order('created_at', { ascending: false })

    if (error) {
      logSupabaseError('Errore nel caricare le recensioni', error)
      setListError(true)
      setReviews([])
    } else {
      setReviews(data ?? [])
    }

    setLoading(false)
  }

  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('id, name, active').order('name')

    if (error) {
      logSupabaseError('Errore nel caricare i prodotti per il form', error)
      return
    }

    setProducts(data ?? [])
  }

  useEffect(() => {
    void fetchReviews()
    void fetchProducts()
  }, [])

  const pendingReviews = reviews.filter((review) => !review.approved)
  const approvedReviews = reviews.filter((review) => review.approved)

  // --- Azioni sulle recensioni esistenti --------------------------------
  async function handleApprove(review) {
    setBusyId(review.id)
    setActionError(false)

    const { error } = await supabase.from('reviews').update({ approved: true }).eq('id', review.id)

    if (error) {
      logSupabaseError(`Errore nell'approvare la recensione ${review.id}`, error)
      setActionError(true)
    } else {
      setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, approved: true } : item)))
    }

    setBusyId(null)
  }

  // Usata sia per "Rifiuta" (in attesa) sia per "Elimina" (approvata):
  // in entrambi i casi la recensione viene cancellata definitivamente.
  async function handleDelete(review, confirmKey) {
    if (!window.confirm(t(confirmKey, { name: review.customer_name }))) return

    setBusyId(review.id)
    setActionError(false)

    const { error } = await supabase.from('reviews').delete().eq('id', review.id)

    if (error) {
      logSupabaseError(`Errore nell'eliminare la recensione ${review.id}`, error)
      setActionError(true)
    } else {
      setReviews((current) => current.filter((item) => item.id !== review.id))
    }

    setBusyId(null)
  }

  // --- Form di inserimento manuale ----------------------------------------
  function handleFieldChange(field) {
    return (event) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
      setForm((current) => ({ ...current, [field]: value }))
    }
  }

  function openForm() {
    setForm(EMPTY_FORM)
    setFormErrorKey(null)
    setSavedNotice(false)
    setShowForm(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormErrorKey(null)

    const customerName = form.customerName.trim()
    if (!customerName || !form.productId) {
      setFormErrorKey('adminReviews.form.requiredError')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('reviews').insert({
      customer_name: customerName,
      product_id: form.productId,
      rating: Number(form.rating),
      comment: form.comment.trim() || null,
      approved: form.approved,
    })

    setSaving(false)

    if (error) {
      logSupabaseError('Errore nel creare la recensione', error)
      setFormErrorKey('adminReviews.form.saveError')
      return
    }

    setShowForm(false)
    setSavedNotice(true)
    void fetchReviews()
  }

  function renderReview(review, actions) {
    return (
      <li className="adminreviews-card" key={review.id}>
        <div className="adminreviews-card-header">
          <div className="adminreviews-card-who">
            <span className="adminreviews-card-name">{review.customer_name}</span>
            <StarRating rating={review.rating} />
          </div>
          <span className="adminreviews-card-date">{formatDay(review.created_at)}</span>
        </div>
        <p className="adminreviews-card-product">
          {t('adminReviews.productLabel')}: <strong>{review.products?.name ?? '—'}</strong>
        </p>
        {review.comment ? (
          <p className="adminreviews-card-comment">{review.comment}</p>
        ) : (
          <p className="adminreviews-card-comment adminreviews-card-comment-empty">{t('adminReviews.noComment')}</p>
        )}
        <div className="adminreviews-card-actions">{actions}</div>
      </li>
    )
  }

  return (
    <div className="admin-page">
      <AdminNav />

      <div className="admin-header">
        <h1 className="admin-title">{t('adminReviews.title')}</h1>
        {!showForm && (
          <button type="button" className="btn-primary" onClick={openForm}>
            {t('adminReviews.addButton')}
          </button>
        )}
      </div>

      {savedNotice && (
        <p className="admin-message adminreviews-notice" role="status">
          {t('adminReviews.form.saved')}
        </p>
      )}

      {/* --- Form di inserimento manuale --- */}
      {showForm && (
        <div className="admin-form-panel">
          <h2>{t('adminReviews.form.title')}</h2>
          <p className="admin-form-hint">{t('adminReviews.form.intro')}</p>

          <form className="admin-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="adminreviews-name">
                {t('adminReviews.form.customerName')}
              </label>
              <input
                id="adminreviews-name"
                className="auth-input"
                value={form.customerName}
                onChange={handleFieldChange('customerName')}
                maxLength={80}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="adminreviews-product">
                {t('adminReviews.form.product')}
              </label>
              <select
                id="adminreviews-product"
                className="auth-input"
                value={form.productId}
                onChange={handleFieldChange('productId')}
                required
              >
                <option value="">{t('adminReviews.form.productPlaceholder')}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.active === false ? `${product.name} (${t('admin.table.inactive')})` : product.name}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="adminreviews-rating">
              <legend className="auth-label">{t('adminReviews.form.rating')}</legend>
              <div className="adminreviews-rating-options">
                {RATINGS.map((value) => (
                  <label
                    key={value}
                    className={
                      form.rating === value
                        ? 'adminreviews-rating-option adminreviews-rating-option-selected'
                        : 'adminreviews-rating-option'
                    }
                  >
                    <input
                      type="radio"
                      name="adminreviews-rating"
                      value={value}
                      checked={form.rating === value}
                      onChange={handleFieldChange('rating')}
                    />
                    {value} ★
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="auth-field">
              <label className="auth-label" htmlFor="adminreviews-comment">
                {t('adminReviews.form.comment')}
              </label>
              <textarea
                id="adminreviews-comment"
                className="auth-input admin-textarea"
                rows={4}
                value={form.comment}
                onChange={handleFieldChange('comment')}
              />
            </div>

            <label className="adminreviews-checkbox">
              <input type="checkbox" checked={form.approved} onChange={handleFieldChange('approved')} />
              {t('adminReviews.form.publishNow')}
            </label>

            {formErrorKey && <p className="auth-error">{t(formErrorKey)}</p>}

            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('adminReviews.form.saving') : t('adminReviews.form.save')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                {t('adminReviews.form.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p className="admin-message">{t('adminReviews.loading')}</p>}
      {!loading && listError && <p className="admin-message">{t('adminReviews.error')}</p>}
      {actionError && <p className="admin-stock-error">{t('adminReviews.actionError')}</p>}

      {!loading && !listError && (
        <>
          {/* --- In attesa di approvazione --- */}
          <section className="adminreviews-section">
            <h2 className="adminreviews-section-title">
              {t('adminReviews.pendingTitle')} <span className="adminreviews-count">{pendingReviews.length}</span>
            </h2>
            {pendingReviews.length === 0 ? (
              <p className="admin-message">{t('adminReviews.pendingEmpty')}</p>
            ) : (
              <ul className="adminreviews-list">
                {pendingReviews.map((review) =>
                  renderReview(
                    review,
                    <>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={busyId === review.id}
                        onClick={() => handleApprove(review)}
                      >
                        {t('adminReviews.approve')}
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        disabled={busyId === review.id}
                        onClick={() => handleDelete(review, 'adminReviews.rejectConfirm')}
                      >
                        {t('adminReviews.reject')}
                      </button>
                    </>
                  )
                )}
              </ul>
            )}
          </section>

          {/* --- Già approvate --- */}
          <section className="adminreviews-section">
            <h2 className="adminreviews-section-title">
              {t('adminReviews.approvedTitle')} <span className="adminreviews-count">{approvedReviews.length}</span>
            </h2>
            {approvedReviews.length === 0 ? (
              <p className="admin-message">{t('adminReviews.approvedEmpty')}</p>
            ) : (
              <ul className="adminreviews-list">
                {approvedReviews.map((review) =>
                  renderReview(
                    review,
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      disabled={busyId === review.id}
                      onClick={() => handleDelete(review, 'adminReviews.deleteConfirm')}
                    >
                      {t('adminReviews.delete')}
                    </button>
                  )
                )}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default AdminReviews
