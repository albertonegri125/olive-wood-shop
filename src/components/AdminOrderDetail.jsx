// src/components/AdminOrderDetail.jsx
//
// Pannello laterale di dettaglio di un ordine nel pannello admin: prodotti
// acquistati (con SKU), sconto, totale, indirizzo di spedizione, cambio
// stato e numero di tracking. Estratto da AdminOrders.jsx perché lo stesso
// dettaglio serve anche nella sezione Clienti (storico ordini di un
// cliente).
//
// "order" deve includere le righe con i prodotti collegati, cioè essere
// letto con ORDER_WITH_ITEMS_SELECT (vedi sotto). Le modifiche di stato e
// tracking vengono salvate qui direttamente su Supabase (policy admin di
// schema_admin_orders.sql) e poi comunicate al chiamante con
// onOrderUpdated(orderId, patch), così può aggiornare la propria lista
// senza ricaricarla.
//
// Va montato con key={order.id}: così lo stato interno (bozza del
// tracking, errori, "Copiato!") riparte da zero a ogni ordine aperto.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { formatDate, formatPrice } from '../lib/adminFormat'
import '../pages/AdminOrders.css'

// Colonne da leggere per un ordine da mostrare in questo pannello.
export const ORDER_WITH_ITEMS_SELECT = '*, order_items(*, products(name, sku))'

// Stati selezionabili nel filtro di AdminOrders e nel select di cambio
// stato qui sotto, nell'ordine in cui un ordine li attraversa normalmente
// (a parte "paid_stock_issue", un ramo a parte per un problema di scorte
// da risolvere manualmente).
export const ORDER_STATUSES = ['paid', 'paid_stock_issue', 'processing', 'shipped', 'delivered']

function logSupabaseError(context, error) {
  console.error(`[AdminOrderDetail] ${context}:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  })
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

function AdminOrderDetail({ order, customerLabel, onClose, onOrderUpdated }) {
  const { t } = useTranslation()

  const [trackingDraft, setTrackingDraft] = useState(order.tracking_number ?? '')
  const [savingTracking, setSavingTracking] = useState(false)
  const [trackingError, setTrackingError] = useState(false)
  const [statusUpdateError, setStatusUpdateError] = useState(false)
  const [copyState, setCopyState] = useState('idle') // 'idle' | 'copied' | 'error'

  const addressLines = formatShippingAddressLines(order.shipping_address)

  async function handleStatusChange(event) {
    const newStatus = event.target.value
    setStatusUpdateError(false)

    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id)

    if (error) {
      logSupabaseError(`Errore nell'aggiornare lo stato dell'ordine ${order.id}`, error)
      setStatusUpdateError(true)
      return
    }

    onOrderUpdated(order.id, { status: newStatus })
  }

  async function handleSaveTracking() {
    setSavingTracking(true)
    setTrackingError(false)

    const trimmed = trackingDraft.trim()
    const { error } = await supabase
      .from('orders')
      .update({ tracking_number: trimmed || null })
      .eq('id', order.id)

    if (error) {
      logSupabaseError(`Errore nel salvare il tracking dell'ordine ${order.id}`, error)
      setTrackingError(true)
      setSavingTracking(false)
      return
    }

    onOrderUpdated(order.id, { tracking_number: trimmed || null })
    setSavingTracking(false)
  }

  async function handleCopyAddress() {
    if (addressLines.length === 0) return

    try {
      await navigator.clipboard.writeText(addressLines.join('\n'))
      setCopyState('copied')
    } catch (error) {
      console.error('[AdminOrderDetail] Errore nel copiare l\'indirizzo negli appunti:', error)
      setCopyState('error')
    }

    // Il feedback torna allo stato normale da solo dopo un paio di
    // secondi, così il bottone non resta bloccato su "Copiato!" per
    // sempre se l'admin non ci fa più caso.
    setTimeout(() => setCopyState('idle'), 2000)
  }

  return (
    <>
      <div className="adminorders-detail-backdrop" onClick={onClose} />
      <aside className="adminorders-detail-panel" aria-label={t('adminOrders.detail.title')}>
        <div className="adminorders-detail-header">
          <h2>{t('adminOrders.detail.title')}</h2>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            {t('adminOrders.detail.close')}
          </button>
        </div>

        {order.status === 'paid_stock_issue' && (
          <span className="adminorders-status-badge adminorders-status-badge-warning">
            {t('adminOrders.stockIssueBadge')}
          </span>
        )}

        <dl className="adminorders-detail-meta">
          <div className="adminorders-detail-meta-row">
            <dt>{t('adminOrders.detail.orderNumber')}</dt>
            <dd className="admin-sku">{order.id.slice(0, 8).toUpperCase()}</dd>
          </div>
          <div className="adminorders-detail-meta-row">
            <dt>{t('adminOrders.detail.customerLabel')}</dt>
            <dd>{customerLabel}</dd>
          </div>
          <div className="adminorders-detail-meta-row">
            <dt>{t('adminOrders.table.date')}</dt>
            <dd>{formatDate(order.created_at)}</dd>
          </div>
        </dl>

        {/* --- Prodotti acquistati --- */}
        <section className="adminorders-detail-section">
          <h3>{t('adminOrders.detail.itemsTitle')}</h3>
          <ul className="adminorders-detail-items">
            {(order.order_items ?? []).map((item) => {
              // Come per il nome: SKU letto dal prodotto se esiste ancora,
              // altrimenti dallo snapshot salvato alla sua eliminazione
              // (vedi schema_products_sku.sql).
              const sku = item.products?.sku ?? item.product_sku_snapshot

              return (
                <li className="adminorders-detail-item" key={item.id}>
                  <span>
                    {item.products?.name ?? item.product_name_snapshot ?? t('adminOrders.detail.itemUnknown')}{' '}
                    <span className="adminorders-detail-item-qty">× {item.quantity}</span>
                    <span className="adminorders-detail-item-sku">
                      {t('adminOrders.detail.skuLabel')}: <span className="admin-sku">{sku ?? '—'}</span>
                    </span>
                  </span>
                  <span>{formatPrice(item.price_at_purchase * item.quantity)}</span>
                </li>
              )
            })}
          </ul>

          {order.discount_percentage > 0 && (
            <p className="adminorders-discount">
              {t('adminOrders.detail.discountLabel')} ({order.discount_percentage}%): −
              {formatPrice(order.discount_amount)}
            </p>
          )}

          <div className="adminorders-detail-total">
            <span>{t('adminOrders.detail.totalLabel')}</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </section>

        {/* --- Indirizzo di spedizione --- */}
        <section className="adminorders-detail-section">
          <h3>{t('adminOrders.detail.shippingTitle')}</h3>

          {addressLines.length === 0 ? (
            <p className="admin-message">{t('adminOrders.detail.noShipping')}</p>
          ) : (
            <>
              <address className="adminorders-address">
                {addressLines.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </address>
              <button type="button" className="btn-secondary btn-sm" onClick={handleCopyAddress}>
                {copyState === 'copied' ? t('adminOrders.detail.addressCopied') : t('adminOrders.detail.copyAddress')}
              </button>
              {copyState === 'error' && <p className="admin-stock-error">{t('adminOrders.detail.copyError')}</p>}
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
              value={order.status}
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
  )
}

export default AdminOrderDetail
