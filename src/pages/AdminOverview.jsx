// src/pages/AdminOverview.jsx
//
// Sezione "Panoramica" del pannello admin: pagina di default di /admin
// (protetta da RequireAdmin). Mostra:
// - Avvisi da gestire: ordini "paid_stock_issue" e recensioni in attesa
// - Card riepilogo: ordini totali, fatturato totale, fatturato del mese,
//   prodotti in catalogo, prodotti in esaurimento (stock <= 2)
// - Ultimi 5 ordini, ognuno con link al suo dettaglio in /admin/ordini
// - Top 5 prodotti più venduti
//
// Numeri e classifica arrivano dalle funzioni SQL admin_dashboard_stats() e
// admin_top_products() (vedi schema_admin_dashboard.sql), calcolate sul
// database invece che scaricando tutti gli ordini nel browser. Gli ultimi
// ordini sono invece una normale query su "orders" (policy admin di
// schema_admin_orders.sql).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { formatDate, formatPrice } from '../lib/adminFormat'
import AdminNav from '../components/AdminNav'
import './Admin.css'
import './AdminOrders.css'
import './AdminOverview.css'

function logSupabaseError(context, error) {
  console.error(`[AdminOverview] ${context}:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  })
}

// Soglia "in esaurimento": stessa della funzione admin_dashboard_stats().
const LOW_STOCK_THRESHOLD = 2

function AdminOverview() {
  const { t } = useTranslation()

  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(false)
  const [recentOrders, setRecentOrders] = useState([])
  const [recentOrdersError, setRecentOrdersError] = useState(false)
  const [emailsById, setEmailsById] = useState({})
  const [topProducts, setTopProducts] = useState([])
  const [topProductsError, setTopProductsError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const { data, error } = await supabase.rpc('admin_dashboard_stats')
      if (error) {
        logSupabaseError('Errore nel caricare le statistiche', error)
        setStatsError(true)
        return
      }
      setStats(data)
    }

    async function fetchRecentOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, total, status, user_id')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        logSupabaseError('Errore nel caricare gli ultimi ordini', error)
        setRecentOrdersError(true)
        return
      }

      const orders = data ?? []
      setRecentOrders(orders)

      // Email dei clienti: "orders" non ha una foreign key verso "profiles"
      // (vedi nota in AdminOrders.jsx), quindi una query separata.
      const userIds = [...new Set(orders.map((order) => order.user_id))]
      if (userIds.length === 0) return

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)

      if (profilesError) {
        logSupabaseError('Errore nel caricare le email dei clienti', profilesError)
        return
      }

      setEmailsById(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile.email])))
    }

    async function fetchTopProducts() {
      const { data, error } = await supabase.rpc('admin_top_products', { p_limit: 5 })
      if (error) {
        logSupabaseError('Errore nel caricare i prodotti più venduti', error)
        setTopProductsError(true)
        return
      }
      setTopProducts(data ?? [])
    }

    async function fetchAll() {
      await Promise.all([fetchStats(), fetchRecentOrders(), fetchTopProducts()])
      setLoading(false)
    }

    void fetchAll()
  }, [])

  const cards = stats
    ? [
        { key: 'totalOrders', value: stats.total_orders, to: '/admin/ordini' },
        { key: 'totalRevenue', value: formatPrice(stats.total_revenue) },
        { key: 'monthRevenue', value: formatPrice(stats.month_revenue) },
        { key: 'productsCount', value: stats.products_count, to: '/admin/prodotti' },
        {
          key: 'lowStock',
          value: stats.low_stock_count,
          to: '/admin/prodotti',
          warning: stats.low_stock_count > 0,
        },
      ]
    : []

  return (
    <div className="admin-page">
      <AdminNav />

      <div className="admin-header">
        <h1 className="admin-title">{t('adminOverview.title')}</h1>
      </div>

      {loading && <p className="admin-message">{t('adminOverview.loading')}</p>}

      {!loading && (
        <>
          {/* --- Avvisi: solo quando c'è davvero qualcosa da fare --- */}
          {stats && (stats.stock_issue_orders > 0 || stats.pending_reviews > 0) && (
            <div className="adminoverview-alerts">
              {stats.stock_issue_orders > 0 && (
                <div className="adminoverview-alert adminoverview-alert-warning" role="alert">
                  <p className="adminoverview-alert-text">
                    <strong>{t('adminOverview.alerts.stockIssueTitle', { count: stats.stock_issue_orders })}</strong>{' '}
                    {t('adminOverview.alerts.stockIssueText')}
                  </p>
                  <Link to="/admin/ordini?stato=paid_stock_issue" className="btn-secondary btn-sm">
                    {t('adminOverview.alerts.stockIssueLink')}
                  </Link>
                </div>
              )}
              {stats.pending_reviews > 0 && (
                <div className="adminoverview-alert" role="status">
                  <p className="adminoverview-alert-text">
                    <strong>{t('adminOverview.alerts.pendingReviewsTitle', { count: stats.pending_reviews })}</strong>{' '}
                    {t('adminOverview.alerts.pendingReviewsText')}
                  </p>
                  <Link to="/admin/recensioni" className="btn-secondary btn-sm">
                    {t('adminOverview.alerts.pendingReviewsLink')}
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* --- Card riepilogo --- */}
          {statsError ? (
            <p className="admin-message">{t('adminOverview.statsError')}</p>
          ) : (
            <ul className="adminoverview-cards">
              {cards.map((card) => {
                const content = (
                  <>
                    <span className="adminoverview-card-label">
                      {t(`adminOverview.cards.${card.key}`, { threshold: LOW_STOCK_THRESHOLD })}
                    </span>
                    <span className="adminoverview-card-value">{card.value}</span>
                  </>
                )
                const className = card.warning ? 'adminoverview-card adminoverview-card-warning' : 'adminoverview-card'

                return (
                  <li key={card.key}>
                    {card.to ? (
                      <Link to={card.to} className={`${className} adminoverview-card-link`}>
                        {content}
                      </Link>
                    ) : (
                      <div className={className}>{content}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="adminoverview-columns">
            {/* --- Ultimi 5 ordini --- */}
            <section className="adminoverview-panel">
              <div className="adminoverview-panel-header">
                <h2>{t('adminOverview.recentOrders.title')}</h2>
                <Link to="/admin/ordini" className="adminoverview-panel-link">
                  {t('adminOverview.recentOrders.viewAll')}
                </Link>
              </div>

              {recentOrdersError && <p className="admin-message">{t('adminOverview.recentOrders.error')}</p>}
              {!recentOrdersError && recentOrders.length === 0 && (
                <p className="admin-message">{t('adminOverview.recentOrders.empty')}</p>
              )}
              {!recentOrdersError && recentOrders.length > 0 && (
                <ul className="adminoverview-list">
                  {recentOrders.map((order) => (
                    <li key={order.id}>
                      <Link to={`/admin/ordini?ordine=${order.id}`} className="adminoverview-order">
                        <span className="adminoverview-order-main">
                          <span className="adminoverview-order-email">
                            {emailsById[order.user_id] ?? t('adminOrders.customerUnknown')}
                          </span>
                          <span className="adminoverview-order-date">{formatDate(order.created_at)}</span>
                        </span>
                        <span className="adminoverview-order-side">
                          <span className="adminoverview-order-total">{formatPrice(order.total)}</span>
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
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* --- Prodotti più venduti --- */}
            <section className="adminoverview-panel">
              <div className="adminoverview-panel-header">
                <h2>{t('adminOverview.topProducts.title')}</h2>
              </div>

              {topProductsError && <p className="admin-message">{t('adminOverview.topProducts.error')}</p>}
              {!topProductsError && topProducts.length === 0 && (
                <p className="admin-message">{t('adminOverview.topProducts.empty')}</p>
              )}
              {!topProductsError && topProducts.length > 0 && (
                <ol className="adminoverview-list adminoverview-top">
                  {topProducts.map((product, index) => (
                    <li key={product.product_id ?? `deleted-${product.name}`} className="adminoverview-top-item">
                      <span className="adminoverview-top-rank">{index + 1}</span>
                      <span className="adminoverview-top-main">
                        <span className="adminoverview-top-name">
                          {product.name ?? t('adminOrders.detail.itemUnknown')}
                        </span>
                        {product.sku && <span className="admin-sku adminoverview-top-sku">{product.sku}</span>}
                      </span>
                      <span className="adminoverview-top-qty">
                        {t('adminOverview.topProducts.sold', { count: Number(product.quantity_sold) })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

export default AdminOverview
