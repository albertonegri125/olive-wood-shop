// src/pages/Account.jsx
//
// Pagina dell'account (/account, protetta da RequireAuth): mostra i dati
// base del profilo (nome, email) letti dalla tabella "profiles", e lo
// storico ordini dell'utente (creati dal webhook Stripe dopo un pagamento
// andato a buon fine, vedi supabase/functions/stripe-webhook).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import './Account.css'

function formatPrice(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date(value))
}

function Account() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Carichiamo la riga del profilo collegata all'utente loggato (creata al
  // momento della registrazione, vedi AuthContext.signUp).
  useEffect(() => {
    async function fetchProfile() {
      setLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        // Non blocchiamo la pagina per questo: mostriamo semplicemente i
        // dati che abbiamo già dalla sessione (email dell'utente Supabase).
        console.error(error)
      } else {
        setProfile(data)
      }

      setLoading(false)
    }

    fetchProfile()
  }, [user.id])

  // --- Storico ordini ---------------------------------------------------
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [ordersErrorKey, setOrdersErrorKey] = useState(null)

  useEffect(() => {
    async function fetchOrders() {
      setLoadingOrders(true)
      setOrdersErrorKey(null)

      // "order_items(*, products(name))" sfrutta le relazioni (order_items
      // -> orders e order_items -> products) per farsi restituire, in
      // un'unica query, ogni ordine con le sue righe e il nome del
      // prodotto di ciascuna riga.
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setOrdersErrorKey('account.ordersError')
      } else {
        setOrders(data ?? [])
      }

      setLoadingOrders(false)
    }

    fetchOrders()
  }, [user.id])

  // Nome da mostrare: quello salvato nel profilo, oppure quello passato in
  // fase di registrazione (metadati dell'utente, valorizzati anche dal
  // login con Google/Apple), oppure nessuno.
  const displayName = profile?.full_name || user.user_metadata?.full_name || ''

  return (
    <div className="account-page">
      <h1 className="account-title">{t('account.title')}</h1>

      <section className="account-section">
        <h2 className="account-section-title">{t('account.profileTitle')}</h2>

        {loading ? (
          <p className="account-message">{t('account.loading')}</p>
        ) : (
          <dl className="account-details">
            <div className="account-detail-row">
              <dt>{t('auth.nameLabel')}</dt>
              <dd>{displayName || t('account.noName')}</dd>
            </div>
            <div className="account-detail-row">
              <dt>{t('auth.emailLabel')}</dt>
              <dd>{profile?.email ?? user.email}</dd>
            </div>
          </dl>
        )}

        <button type="button" className="account-signout" onClick={signOut}>
          {t('navbar.logout')}
        </button>
      </section>

      <section className="account-section">
        <h2 className="account-section-title">{t('account.ordersTitle')}</h2>

        {loadingOrders && <p className="account-message">{t('account.loading')}</p>}
        {!loadingOrders && ordersErrorKey && (
          <p className="account-message">{t(ordersErrorKey)}</p>
        )}
        {!loadingOrders && !ordersErrorKey && orders.length === 0 && (
          <p className="account-message">{t('account.ordersEmpty')}</p>
        )}

        {!loadingOrders && !ordersErrorKey && orders.length > 0 && (
          <ul className="account-orders-list">
            {orders.map((order) => (
              <li className="account-order" key={order.id}>
                <div className="account-order-header">
                  <span className="account-order-date">{formatDate(order.created_at)}</span>
                  <span
                    className={
                      order.status === 'paid_stock_issue'
                        ? 'account-order-status account-order-status-issue'
                        : 'account-order-status'
                    }
                  >
                    {t(`account.orderStatus.${order.status}`, order.status)}
                  </span>
                </div>

                <ul className="account-order-items">
                  {(order.order_items ?? []).map((item) => (
                    <li className="account-order-item" key={item.id}>
                      <span>
                        {item.products?.name ?? item.product_name_snapshot ?? t('account.orderItemUnknown')}{' '}
                        <span className="account-order-item-qty">× {item.quantity}</span>
                      </span>
                      <span>{formatPrice(item.price_at_purchase * item.quantity)}</span>
                    </li>
                  ))}
                </ul>

                {order.discount_percentage > 0 && (
                  <p className="account-order-discount">
                    {t('cart.bundleDiscount', { percentage: order.discount_percentage })} · −
                    {formatPrice(order.discount_amount)}
                  </p>
                )}

                {order.shipping_address?.address && (
                  <div className="account-order-shipping">
                    <span className="account-order-shipping-title">
                      {t('account.shippingAddressTitle')}
                    </span>
                    <address>
                      {order.shipping_address.name && <div>{order.shipping_address.name}</div>}
                      <div>
                        {order.shipping_address.address.line1}
                        {order.shipping_address.address.line2
                          ? `, ${order.shipping_address.address.line2}`
                          : ''}
                      </div>
                      <div>
                        {[
                          order.shipping_address.address.postal_code,
                          order.shipping_address.address.city,
                          order.shipping_address.address.state,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      </div>
                      <div>{order.shipping_address.address.country}</div>
                    </address>
                  </div>
                )}

                <div className="account-order-total">
                  <span>{t('checkout.orderTotal')}</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default Account
