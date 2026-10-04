// src/pages/AdminCustomers.jsx
//
// Sezione "Clienti" del pannello admin (/admin/clienti, protetta da
// RequireAdmin):
// - Elenco degli utenti registrati (tabella profiles) con email, nome,
//   data di registrazione, numero di ordini e totale speso, ricercabile
//   per email e paginato.
// - Click su un cliente: il suo storico ordini completo; click su un
//   ordine: lo stesso pannello di dettaglio di /admin/ordini
//   (AdminOrderDetail), con cambio stato e tracking.
//
// Elenco e aggregati arrivano dalla funzione SQL admin_customers() (vedi
// schema_admin_dashboard.sql): contare ordini e sommare importi per ogni
// cliente nel browser richiederebbe di scaricare tutti gli ordini. Lo
// storico del singolo cliente è invece una normale query su "orders"
// (policy admin di schema_admin_orders.sql).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { formatDate, formatDay, formatPrice } from '../lib/adminFormat'
import AdminNav from '../components/AdminNav'
import AdminOrderDetail, { ORDER_WITH_ITEMS_SELECT } from '../components/AdminOrderDetail'
import '../pages/Auth.css'
import './Admin.css'
import './AdminOrders.css'
import './AdminCustomers.css'

function logSupabaseError(context, error) {
  console.error(`[AdminCustomers] ${context}:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  })
}

const PAGE_SIZE = 20

function countItems(order) {
  return (order.order_items ?? []).reduce((total, item) => total + item.quantity, 0)
}

function AdminCustomers() {
  const { t } = useTranslation()

  // --- Ricerca e paginazione ----------------------------------------------
  const [searchInput, setSearchInput] = useState('')
  const [emailSearch, setEmailSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // --- Elenco clienti -----------------------------------------------------
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)

  useEffect(() => {
    async function fetchCustomers() {
      setLoading(true)
      setListError(false)

      const { data, error } = await supabase.rpc('admin_customers', {
        p_search: emailSearch || null,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      })

      if (error) {
        logSupabaseError('Errore nel caricare i clienti', error)
        setListError(true)
        setCustomers([])
        setTotalCount(0)
      } else {
        const rows = data ?? []
        setCustomers(rows)
        // total_count è ripetuto su ogni riga (vedi admin_customers()):
        // se la pagina è vuota non c'è nessun cliente da contare.
        setTotalCount(rows.length > 0 ? Number(rows[0].total_count) : 0)
      }

      setLoading(false)
    }

    void fetchCustomers()
  }, [page, emailSearch])

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

  // --- Storico ordini del cliente selezionato -----------------------------
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerOrders, setCustomerOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)

  async function openCustomer(customer) {
    setSelectedCustomer(customer)
    setCustomerOrders([])
    setOrdersError(false)
    setOrdersLoading(true)
    // Torna in cima: su mobile l'elenco può essere lungo, e lo storico
    // comparirebbe altrimenti fuori schermo.
    window.scrollTo({ top: 0 })

    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_WITH_ITEMS_SELECT)
      .eq('user_id', customer.id)
      .order('created_at', { ascending: false })

    if (error) {
      logSupabaseError(`Errore nel caricare gli ordini del cliente ${customer.id}`, error)
      setOrdersError(true)
    } else {
      setCustomerOrders(data ?? [])
    }

    setOrdersLoading(false)
  }

  function closeCustomer() {
    setSelectedCustomer(null)
    setSelectedOrder(null)
  }

  function patchOrder(orderId, patch) {
    setCustomerOrders((current) => current.map((order) => (order.id === orderId ? { ...order, ...patch } : order)))
    setSelectedOrder((current) => (current && current.id === orderId ? { ...current, ...patch } : current))
  }

  // --- Vista: storico di un cliente ---------------------------------------
  if (selectedCustomer) {
    return (
      <div className="admin-page">
        <AdminNav />

        <button type="button" className="btn-secondary btn-sm admincustomers-back" onClick={closeCustomer}>
          ← {t('adminCustomers.backToList')}
        </button>

        <div className="admincustomers-profile">
          <h1 className="admin-title admincustomers-profile-email">{selectedCustomer.email ?? '—'}</h1>
          <dl className="admincustomers-profile-meta">
            <div>
              <dt>{t('adminCustomers.table.name')}</dt>
              <dd>{selectedCustomer.full_name || '—'}</dd>
            </div>
            <div>
              <dt>{t('adminCustomers.table.registeredAt')}</dt>
              <dd>{formatDay(selectedCustomer.created_at)}</dd>
            </div>
            <div>
              <dt>{t('adminCustomers.table.orders')}</dt>
              <dd>{selectedCustomer.order_count}</dd>
            </div>
            <div>
              <dt>{t('adminCustomers.table.totalSpent')}</dt>
              <dd>{formatPrice(selectedCustomer.total_spent)}</dd>
            </div>
          </dl>
        </div>

        <h2 className="admincustomers-history-title">{t('adminCustomers.historyTitle')}</h2>

        {ordersLoading && <p className="admin-message">{t('adminCustomers.historyLoading')}</p>}
        {!ordersLoading && ordersError && <p className="admin-message">{t('adminCustomers.historyError')}</p>}
        {!ordersLoading && !ordersError && customerOrders.length === 0 && (
          <p className="admin-message">{t('adminCustomers.historyEmpty')}</p>
        )}

        {!ordersLoading && !ordersError && customerOrders.length > 0 && (
          <ul className="admincustomers-orders">
            {customerOrders.map((order) => (
              <li key={order.id}>
                <button type="button" className="admincustomers-order" onClick={() => setSelectedOrder(order)}>
                  <span className="admincustomers-order-main">
                    <span className="admincustomers-order-date">{formatDate(order.created_at)}</span>
                    <span className="admincustomers-order-items">
                      {t('adminCustomers.itemsCount', { count: countItems(order) })}
                    </span>
                  </span>
                  <span className="admincustomers-order-side">
                    <span className="admincustomers-order-total">{formatPrice(order.total)}</span>
                    <span
                      className={
                        order.status === 'paid_stock_issue'
                          ? 'adminorders-status-badge adminorders-status-badge-warning'
                          : 'adminorders-status-badge'
                      }
                    >
                      {t(`adminOrders.status.${order.status}`, order.status)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedOrder && (
          <AdminOrderDetail
            key={selectedOrder.id}
            order={selectedOrder}
            customerLabel={selectedCustomer.email ?? t('adminOrders.customerUnknown')}
            onClose={() => setSelectedOrder(null)}
            onOrderUpdated={patchOrder}
          />
        )}
      </div>
    )
  }

  // --- Vista: elenco clienti ----------------------------------------------
  return (
    <div className="admin-page">
      <AdminNav />

      <div className="admin-header">
        <h1 className="admin-title">{t('adminCustomers.title')}</h1>
      </div>

      <form className="adminorders-search-form admincustomers-search" onSubmit={handleSearchSubmit}>
        <div className="auth-field adminorders-filter-search">
          <label className="auth-label" htmlFor="admincustomers-search">
            {t('adminCustomers.searchLabel')}
          </label>
          <input
            id="admincustomers-search"
            className="auth-input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('adminCustomers.searchPlaceholder')}
          />
        </div>
        <button type="submit" className="btn-secondary">
          {t('adminCustomers.searchButton')}
        </button>
        {emailSearch && (
          <button type="button" className="btn-secondary" onClick={handleSearchClear}>
            {t('adminCustomers.searchClear')}
          </button>
        )}
      </form>

      {loading && <p className="admin-message">{t('adminCustomers.loading')}</p>}
      {!loading && listError && <p className="admin-message">{t('adminCustomers.error')}</p>}
      {!loading && !listError && customers.length === 0 && (
        <p className="admin-message">{emailSearch ? t('adminCustomers.emptySearch') : t('adminCustomers.empty')}</p>
      )}

      {!loading && !listError && customers.length > 0 && (
        <>
          {/* Tabella da tablet in su, card impilate su mobile: le intestazioni
              di colonna diventano etichette dentro ogni card (data-label). */}
          <div className="admincustomers-table" role="table">
            <div className="admincustomers-row admincustomers-head" role="row">
              <span role="columnheader">{t('adminCustomers.table.email')}</span>
              <span role="columnheader">{t('adminCustomers.table.name')}</span>
              <span role="columnheader">{t('adminCustomers.table.registeredAt')}</span>
              <span role="columnheader">{t('adminCustomers.table.orders')}</span>
              <span role="columnheader">{t('adminCustomers.table.totalSpent')}</span>
              <span role="columnheader">
                <span className="admincustomers-sr-only">{t('adminCustomers.table.actions')}</span>
              </span>
            </div>

            {customers.map((customer) => (
              <div className="admincustomers-row" role="row" key={customer.id}>
                <span className="admincustomers-cell admincustomers-cell-email" role="cell">
                  {customer.email ?? '—'}
                </span>
                <span className="admincustomers-cell" role="cell" data-label={t('adminCustomers.table.name')}>
                  {customer.full_name || '—'}
                </span>
                <span className="admincustomers-cell" role="cell" data-label={t('adminCustomers.table.registeredAt')}>
                  {formatDay(customer.created_at)}
                </span>
                <span className="admincustomers-cell" role="cell" data-label={t('adminCustomers.table.orders')}>
                  {customer.order_count}
                </span>
                <span className="admincustomers-cell" role="cell" data-label={t('adminCustomers.table.totalSpent')}>
                  {formatPrice(customer.total_spent)}
                </span>
                <span className="admincustomers-cell admincustomers-cell-actions" role="cell">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => openCustomer(customer)}>
                    {t('adminCustomers.viewOrders')}
                  </button>
                </span>
              </div>
            ))}
          </div>

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
              <span className="admin-message">{t('adminOrders.pagination.pageInfo', { page, totalPages })}</span>
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
    </div>
  )
}

export default AdminCustomers
