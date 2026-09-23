// src/pages/AdminOrders.jsx
//
// Sezione "Ordini" del pannello admin (/admin/ordini, protetta da
// RequireAdmin): tabella di tutti gli ordini (non solo i propri, a
// differenza di Account.jsx), con filtro per stato, ricerca per email
// cliente, paginazione e un pannello laterale di dettaglio per ogni
// ordine (prodotti acquistati, indirizzo di spedizione, stato,
// tracking).
//
// Query dirette a Supabase, protette dalle policy admin aggiunte in
// schema_admin_orders.sql (stesso pattern di AdminCategories.jsx, non una
// Edge Function: non è un dato critico come "is_admin").
//
// NOTA: non esiste una foreign key diretta tra "orders" e "profiles"
// (orders.user_id referenzia auth.users, non public.profiles), quindi
// PostgREST non può fare l'embed automatico "orders.select('*, profiles(email)')".
// Le email dei clienti vengono quindi recuperate con una query separata sui
// soli user_id della pagina corrente, e abbinate qui in memoria (vedi
// fetchCustomerProfiles).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import AdminNav from '../components/AdminNav'
import '../pages/Auth.css'
import './Admin.css'
import './AdminOrders.css'

function logSupabaseError(context, error) {
  console.error(`[AdminOrders] ${context}:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  })
}

const PAGE_SIZE = 20

// Stati selezionabili nel filtro e nel select di cambio stato del
// dettaglio: gli stessi elencati nella richiesta, nell'ordine in cui un
// ordine li attraversa normalmente (a parte "paid_stock_issue", un ramo a
// parte per un problema di scorte da risolvere manualmente).
const ORDER_STATUSES = ['paid', 'paid_stock_issue', 'processing', 'shipped', 'delivered']

function formatPrice(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value ?? 0)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function countItems(order) {
  return (order.order_items ?? []).reduce((total, item) => total + item.quantity, 0)
}

// Trasforma il JSONB "shipping_address" (stessa forma salvata dal webhook
// Stripe: { name, address: { line1, line2, city, state, postal_code,
// country } }, vedi schema_add_shipping_address.sql e Account.jsx) in un
// testo semplice multilinea, sia per il rendering leggibile sia per il
// bottone "Copia indirizzo".
function formatShippingAddressLines(shippingAddress) {
  if (!shippingAddress?.address) return []

  const { name, address } = shippingAddress
  const lines = []

  if (name) lines.push(name)
  lines.push(address.line1 + (address.line2 ? `, ${address.line2}` : ''))
  lines.push([address.postal_code, address.city, address.state].filter(Boolean).join(' '))
  if (address.country) lines.push(address.country)

  return lines.filter(Boolean)
}

function AdminOrders() {
  const { t } = useTranslation()

  // --- Filtri ---------------------------------------------------------
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [emailSearch, setEmailSearch] = useState('')

  // --- Paginazione ------------------------------------------------------
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // --- Lista ordini -----------------------------------------------------
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(null)
  // Email/nome dei clienti della pagina corrente, per id utente (vedi nota
  // in cima al file sul perché non è un embed diretto della query).
  const [profilesById, setProfilesById] = useState({})

  async function fetchOrders() {
    setLoading(true)
    setListError(null)

    // Se c'è una ricerca per email, la risolviamo PRIMA in un elenco di
    // user_id: "orders" non ha la colonna email, solo "profiles" ce l'ha.
    let matchingUserIds = null
    const trimmedSearch = emailSearch.trim()

    if (trimmedSearch) {
      const { data: matchedProfiles, error: searchError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', `%${trimmedSearch}%`)

      if (searchError) {
        logSupabaseError('Errore nella ricerca per email cliente', searchError)
        setListError(t('adminOrders.error'))
        setOrders([])
        setTotalCount(0)
        setLoading(false)
        return
      }

      matchingUserIds = (matchedProfiles ?? []).map((row) => row.id)

      // Nessun cliente corrisponde alla ricerca: l'elenco ordini è vuoto,
      // niente motivo di interrogare "orders".
      if (matchingUserIds.length === 0) {
        setOrders([])
        setTotalCount(0)
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from('orders')
      .select('*, order_items(*, products(name))', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }
    if (matchingUserIds) {
      query = query.in('user_id', matchingUserIds)
    }

    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      logSupabaseError('Errore nel caricare gli ordini', error)
      setListError(t('adminOrders.error'))
      setOrders([])
      setTotalCount(0)
      setLoading(false)
      return
    }

    const ordersData = data ?? []
    setOrders(ordersData)
    setTotalCount(count ?? 0)

    await fetchCustomerProfiles(ordersData)

    setLoading(false)
  }

  // Recupera email/nome dei clienti SOLO per gli ordini appena caricati
  // (al massimo PAGE_SIZE), e li aggiunge alla mappa già in memoria invece
  // di sovrascriverla: così il dettaglio di un ordine aperto da una pagina
  // precedente continua a mostrare il cliente giusto anche dopo aver
  // cambiato pagina.
  async function fetchCustomerProfiles(ordersData) {
    const userIds = [...new Set(ordersData.map((order) => order.user_id))]
    if (userIds.length === 0) return

    const { data: profilesData, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds)

    if (error) {
      logSupabaseError('Errore nel caricare i profili cliente', error)
      return
    }

    setProfilesById((current) => {
      const next = { ...current }
      for (const profile of profilesData ?? []) {
        next[profile.id] = profile
      }
      return next
    })
  }

  useEffect(() => {
    void fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, emailSearch])

  function handleStatusFilterChange(event) {
    setStatusFilter(event.target.value)
    setPage(1)
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    setEmailSearch(searchInput.trim())
    setPage(1)
  }

  function handleSearchClear() {
    setSearchInput('')
    setEmailSearch('')
    setPage(1)
  }

  // --- Dettaglio ordine (pannello laterale) ------------------------------
  // Copia autonoma dell'ordine selezionato (non derivata da "orders"):
  // così il pannello resta aperto e coerente anche se, cambiando pagina o
  // filtro, quell'ordine non fa più parte dell'elenco corrente.
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [trackingDraft, setTrackingDraft] = useState('')
  const [savingTracking, setSavingTracking] = useState(false)
  const [trackingError, setTrackingError] = useState(false)
  const [statusUpdateError, setStatusUpdateError] = useState(false)
  const [copyState, setCopyState] = useState('idle') // 'idle' | 'copied' | 'error'

  function openDetail(order) {
    setSelectedOrder(order)
    setTrackingDraft(order.tracking_number ?? '')
    setTrackingError(false)
    setStatusUpdateError(false)
    setCopyState('idle')
  }

  function closeDetail() {
    setSelectedOrder(null)
  }

  // Applica una modifica sia alla copia nel pannello sia (se presente)
  // alla riga corrispondente nell'elenco già in memoria, senza dover
  // ricaricare tutto da Supabase.
  function patchOrderEverywhere(orderId, patch) {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, ...patch } : order)))
    setSelectedOrder((current) => (current && current.id === orderId ? { ...current, ...patch } : current))
  }

  async function handleStatusChange(event) {
    const newStatus = event.target.value
    if (!selectedOrder) return

    setStatusUpdateError(false)

    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', selectedOrder.id)

    if (error) {
      logSupabaseError(`Errore nell'aggiornare lo stato dell'ordine ${selectedOrder.id}`, error)
      setStatusUpdateError(true)
      return
    }

    patchOrderEverywhere(selectedOrder.id, { status: newStatus })
  }

  async function handleSaveTracking() {
    if (!selectedOrder) return

    setSavingTracking(true)
    setTrackingError(false)

    const trimmed = trackingDraft.trim()
    const { error } = await supabase
      .from('orders')
      .update({ tracking_number: trimmed || null })
      .eq('id', selectedOrder.id)

    if (error) {
      logSupabaseError(`Errore nel salvare il tracking dell'ordine ${selectedOrder.id}`, error)
      setTrackingError(true)
      setSavingTracking(false)
      return
    }

    patchOrderEverywhere(selectedOrder.id, { tracking_number: trimmed || null })
    setSavingTracking(false)
  }

  async function handleCopyAddress() {
    if (!selectedOrder) return

    const lines = formatShippingAddressLines(selectedOrder.shipping_address)
    if (lines.length === 0) return

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopyState('copied')
    } catch (error) {
      console.error('[AdminOrders] Errore nel copiare l\'indirizzo negli appunti:', error)
      setCopyState('error')
    }

    // Il feedback torna allo stato normale da solo dopo un paio di
    // secondi, così il bottone non resta bloccato su "Copiato!" per
    // sempre se l'admin non ci fa più caso.
    setTimeout(() => setCopyState('idle'), 2000)
  }

  function customerLabel(order) {
    const profile = profilesById[order.user_id]
    return profile?.email ?? t('adminOrders.customerUnknown')
  }

  return (
    <div className="admin-page">
      <AdminNav />

      <div className="admin-header">
        <h1 className="admin-title">{t('adminOrders.title')}</h1>
      </div>

      {/* --- Filtri: stato + ricerca per email --- */}
      <div className="adminorders-filters">
        <div className="auth-field adminorders-filter-status">
          <label className="auth-label" htmlFor="adminorders-status-filter">
            {t('adminOrders.filterLabel')}
          </label>
          <select
            id="adminorders-status-filter"
            className="auth-input"
            value={statusFilter}
            onChange={handleStatusFilterChange}
          >
            <option value="all">{t('adminOrders.filterAll')}</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`adminOrders.status.${status}`)}
              </option>
            ))}
          </select>
        </div>

        <form className="adminorders-search-form" onSubmit={handleSearchSubmit}>
          <div className="auth-field adminorders-filter-search">
            <label className="auth-label" htmlFor="adminorders-search">
              {t('adminOrders.searchLabel')}
            </label>
            <input
              id="adminorders-search"
              className="auth-input"
              type="email"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('adminOrders.searchPlaceholder')}
            />
          </div>
          <button type="submit" className="btn-secondary">
            {t('adminOrders.searchButton')}
          </button>
          {emailSearch && (
            <button type="button" className="btn-secondary" onClick={handleSearchClear}>
              {t('adminOrders.searchClear')}
            </button>
          )}
        </form>
      </div>

      {/* --- Lista ordini --- */}
      {loading && <p className="admin-message">{t('adminOrders.loading')}</p>}
      {!loading && listError && <p className="admin-message">{listError}</p>}
      {!loading && !listError && orders.length === 0 && (
        <p className="admin-message">{t('adminOrders.empty')}</p>
      )}

      {!loading && !listError && orders.length > 0 && (
        <>
          <div className="admin-table-wrapper">
            <div className="adminorders-table" role="table">
              <div className="admin-table-row" role="row">
                <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                  {t('adminOrders.table.date')}
                </span>
                <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                  {t('adminOrders.table.customer')}
                </span>
                <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                  {t('adminOrders.table.total')}
                </span>
                <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                  {t('adminOrders.table.status')}
                </span>
                <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                  {t('adminOrders.table.items')}
                </span>
                <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                  {t('adminOrders.table.actions')}
                </span>
              </div>

              {orders.map((order) => (
                <div className="admin-table-row" role="row" key={order.id}>
                  <div className="admin-table-cell" role="cell">
                    {formatDate(order.created_at)}
                  </div>
                  <div className="admin-table-cell adminorders-cell-customer" role="cell">
                    {customerLabel(order)}
                  </div>
                  <div className="admin-table-cell" role="cell">
                    {formatPrice(order.total)}
                  </div>
                  <div className="admin-table-cell" role="cell">
                    <span
                      className={
                        order.status === 'paid_stock_issue'
                          ? 'adminorders-status-badge adminorders-status-badge-warning'
                          : 'adminorders-status-badge'
                      }
                    >
                      {t(`adminOrders.status.${order.status}`, order.status)}
                    </span>
                  </div>
                  <div className="admin-table-cell" role="cell">
                    {countItems(order)}
                  </div>
                  <div className="admin-table-cell admin-table-cell-actions" role="cell">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => openDetail(order)}>
                      {t('adminOrders.table.details')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* --- Paginazione: solo se serve più di una pagina --- */}
          {totalPages > 1 && (
            <div className="adminorders-pagination">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t('adminOrders.pagination.previous')}
              </button>
              <span className="admin-message">
                {t('adminOrders.pagination.pageInfo', { page, totalPages })}
              </span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                {t('adminOrders.pagination.next')}
              </button>
            </div>
          )}
        </>
      )}

      {/* --- Pannello laterale di dettaglio --- */}
      {selectedOrder && (
        <>
          <div className="adminorders-detail-backdrop" onClick={closeDetail} />
          <aside className="adminorders-detail-panel" aria-label={t('adminOrders.detail.title')}>
            <div className="adminorders-detail-header">
              <h2>{t('adminOrders.detail.title')}</h2>
              <button type="button" className="btn-secondary btn-sm" onClick={closeDetail}>
                {t('adminOrders.detail.close')}
              </button>
            </div>

            {selectedOrder.status === 'paid_stock_issue' && (
              <span className="adminorders-status-badge adminorders-status-badge-warning">
                {t('adminOrders.stockIssueBadge')}
              </span>
            )}

            <dl className="adminorders-detail-meta">
              <div className="adminorders-detail-meta-row">
                <dt>{t('adminOrders.detail.customerLabel')}</dt>
                <dd>{customerLabel(selectedOrder)}</dd>
              </div>
              <div className="adminorders-detail-meta-row">
                <dt>{t('adminOrders.table.date')}</dt>
                <dd>{formatDate(selectedOrder.created_at)}</dd>
              </div>
            </dl>

            {/* --- Prodotti acquistati --- */}
            <section className="adminorders-detail-section">
              <h3>{t('adminOrders.detail.itemsTitle')}</h3>
              <ul className="adminorders-detail-items">
                {(selectedOrder.order_items ?? []).map((item) => (
                  <li className="adminorders-detail-item" key={item.id}>
                    <span>
                      {item.products?.name ?? t('adminOrders.detail.itemUnknown')}{' '}
                      <span className="adminorders-detail-item-qty">× {item.quantity}</span>
                    </span>
                    <span>{formatPrice(item.price_at_purchase * item.quantity)}</span>
                  </li>
                ))}
              </ul>

              {selectedOrder.discount_percentage > 0 && (
                <p className="adminorders-discount">
                  {t('adminOrders.detail.discountLabel')} ({selectedOrder.discount_percentage}%): −
                  {formatPrice(selectedOrder.discount_amount)}
                </p>
              )}

              <div className="adminorders-detail-total">
                <span>{t('adminOrders.detail.totalLabel')}</span>
                <span>{formatPrice(selectedOrder.total)}</span>
              </div>
            </section>

            {/* --- Indirizzo di spedizione --- */}
            <section className="adminorders-detail-section">
              <h3>{t('adminOrders.detail.shippingTitle')}</h3>

              {formatShippingAddressLines(selectedOrder.shipping_address).length === 0 ? (
                <p className="admin-message">{t('adminOrders.detail.noShipping')}</p>
              ) : (
                <>
                  <address className="adminorders-address">
                    {formatShippingAddressLines(selectedOrder.shipping_address).map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                  </address>
                  <button type="button" className="btn-secondary btn-sm" onClick={handleCopyAddress}>
                    {copyState === 'copied'
                      ? t('adminOrders.detail.addressCopied')
                      : t('adminOrders.detail.copyAddress')}
                  </button>
                  {copyState === 'error' && (
                    <p className="admin-stock-error">{t('adminOrders.detail.copyError')}</p>
                  )}
                </>
              )}
            </section>

            {/* --- Stato ordine --- */}
            <section className="adminorders-detail-section">
              <div className="auth-field">
                <label className="auth-label" htmlFor="adminorders-detail-status">
                  {t('adminOrders.detail.statusLabel')}
                </label>
                <select
                  id="adminorders-detail-status"
                  className="auth-input"
                  value={selectedOrder.status}
                  onChange={handleStatusChange}
                >
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`adminOrders.status.${status}`)}
                    </option>
                  ))}
                </select>
              </div>
              {statusUpdateError && <p className="admin-stock-error">{t('adminOrders.detail.statusUpdateError')}</p>}
            </section>

            {/* --- Tracking --- */}
            <section className="adminorders-detail-section">
              <div className="auth-field">
                <label className="auth-label" htmlFor="adminorders-detail-tracking">
                  {t('adminOrders.detail.trackingLabel')}
                </label>
                <div className="adminorders-tracking-editor">
                  <input
                    id="adminorders-detail-tracking"
                    className="auth-input"
                    value={trackingDraft}
                    onChange={(event) => setTrackingDraft(event.target.value)}
                    placeholder={t('adminOrders.detail.trackingPlaceholder')}
                  />
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={savingTracking}
                    onClick={handleSaveTracking}
                  >
                    {savingTracking ? t('adminOrders.detail.trackingSaving') : t('adminOrders.detail.trackingSave')}
                  </button>
                </div>
                {trackingError && <p className="admin-stock-error">{t('adminOrders.detail.trackingSaveError')}</p>}
              </div>
            </section>
          </aside>
        </>
      )}
    </div>
  )
}

export default AdminOrders
