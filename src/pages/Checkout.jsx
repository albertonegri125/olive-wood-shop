// src/pages/Checkout.jsx
//
// Pagina di checkout (/checkout, protetta da RequireAuth): mostra il
// riepilogo dell'ordine (articoli nel carrello + totale) e per ora un
// bottone che si limita a mostrare un messaggio placeholder.
//
// Il collegamento reale a Stripe Checkout (creazione della sessione di
// pagamento) e il webhook che scala lo stock e crea l'ordine in "orders"/
// "order_items" richiedono una funzione server-side (non può girare solo
// nel browser, per motivi di sicurezza): li implementeremo in uno step
// successivo. src/lib/stripeClient.js è già pronto per quando servirà.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../context/CartContext'
import './Checkout.css'

function formatPrice(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function Checkout() {
  const { t } = useTranslation()
  const { cart, getTotal, getDiscountPercentage, getDiscountedTotal } = useCart()

  const discountPercentage = getDiscountPercentage()
  const total = getTotal()
  const discountedTotal = getDiscountedTotal()

  // Mostrato dopo il click su "Procedi al pagamento": per ora un semplice
  // messaggio, in attesa della vera integrazione con Stripe.
  const [showPlaceholderMessage, setShowPlaceholderMessage] = useState(false)

  // Se l'utente arriva qui a carrello vuoto (es. link diretto), non ha
  // senso mostrare un riepilogo vuoto: lo invitiamo a tornare al negozio.
  if (cart.length === 0) {
    return (
      <div className="checkout-page">
        <h1 className="checkout-title">{t('checkout.title')}</h1>
        <p className="checkout-placeholder">{t('cart.empty')}</p>
        <Link to="/shop" className="btn-primary">
          {t('cart.goToShop')}
        </Link>
      </div>
    )
  }

  return (
    <div className="checkout-page">
      <h1 className="checkout-title">{t('checkout.title')}</h1>
      <h2 className="checkout-summary-title">{t('checkout.summary')}</h2>

      <ul className="checkout-summary-list">
        {cart.map((item) => (
          <li className="checkout-summary-item" key={item.product_id}>
            <span className="checkout-summary-item-name">
              {item.name} <span className="checkout-summary-item-qty">× {item.quantity}</span>
            </span>
            <span className="checkout-summary-item-price">
              {formatPrice(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {/* Sconto bundle: stessa logica e stesso badge in accento verde già
          mostrati nel Carrello (vedi CartContext.getDiscountPercentage/
          getDiscountedTotal), per coerenza tra le due pagine. */}
      {discountPercentage > 0 && (
        <div className="checkout-discount-row">
          <span className="checkout-discount-badge">
            {t('cart.bundleDiscount', { percentage: discountPercentage })}
          </span>
          <span className="checkout-discount-amount">−{formatPrice(total - discountedTotal)}</span>
        </div>
      )}

      <div className="checkout-total-row">
        <span>{t('checkout.orderTotal')}</span>
        <span className="checkout-total-wrapper">
          {discountPercentage > 0 && (
            <span className="checkout-total-original">{formatPrice(total)}</span>
          )}
          <span className="checkout-total-amount">{formatPrice(discountedTotal)}</span>
        </span>
      </div>

      <button
        type="button"
        className="btn-primary checkout-pay-button"
        onClick={() => setShowPlaceholderMessage(true)}
      >
        {t('checkout.placeOrder')}
      </button>

      {showPlaceholderMessage && (
        <p className="checkout-placeholder-message">{t('checkout.paymentComingSoon')}</p>
      )}
    </div>
  )
}

export default Checkout
