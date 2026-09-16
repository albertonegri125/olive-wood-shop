// src/pages/Checkout.jsx
//
// Pagina di checkout (/checkout, protetta da RequireAuth): mostra il
// riepilogo dell'ordine (articoli nel carrello + totale) e il bottone che
// avvia il pagamento vero e proprio con Stripe.
//
// Il bottone "Procedi al pagamento" NON crea la sessione di pagamento qui
// nel browser (impossibile farlo in sicurezza: servirebbe la chiave
// segreta di Stripe, che non deve mai finire nel frontend). Chiama invece
// la Edge Function "create-checkout-session" (vedi
// supabase/functions/create-checkout-session/index.ts), che gira lato
// server: verifica prezzi/stock reali sul database, ricalcola lo sconto
// bundle in modo indipendente e crea la sessione Stripe. Riceve indietro
// solo l'URL della pagina di pagamento ospitata da Stripe, a cui il
// browser viene reindirizzato con un semplice window.location.href — non
// serve nessuna libreria Stripe.js lato client per questo flusso.
//
// Dopo il pagamento, Stripe reindirizza a /checkout/success o
// /checkout/cancel (vedi CheckoutSuccess.jsx). La creazione VERA
// dell'ordine (riga in "orders"/"order_items", scalo dello stock) avviene
// però nel webhook "stripe-webhook", non in questa pagina: è l'unico modo
// per essere certi che venga registrata solo quando Stripe conferma che il
// pagamento è stato effettivamente completato.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabaseClient'
import './Checkout.css'

function formatPrice(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function Checkout() {
  const { t } = useTranslation()
  // "getDiscountPercentage"/"getDiscountedTotal" servono SOLO per mostrare
  // un'anteprima all'utente in questa pagina: il valore che conta davvero
  // (quello effettivamente addebitato) viene ricalcolato da zero lato
  // server nella Edge Function, che non riceve né si fida di questi numeri.
  const { cart, getTotal, getDiscountPercentage, getDiscountedTotal } = useCart()

  const discountPercentage = getDiscountPercentage()
  const total = getTotal()
  const discountedTotal = getDiscountedTotal()

  const [processing, setProcessing] = useState(false)
  const [errorKey, setErrorKey] = useState(null)

  async function handleCheckout() {
    setErrorKey(null)
    setProcessing(true)

    // Mandiamo SOLO product_id e quantity: nessun prezzo, nessuno sconto.
    // supabase.functions.invoke() allega automaticamente il token
    // dell'utente loggato nell'header Authorization, che la funzione usa
    // per sapere chi sta pagando (non ci fidiamo di un user_id nel corpo).
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      },
    })

    if (error || !data?.url) {
      console.error(error)
      setErrorKey('checkout.paymentError')
      setProcessing(false)
      return
    }

    // Redirect completo del browser verso la pagina di pagamento ospitata
    // da Stripe: non torniamo indietro da qui, la pagina cambia del tutto.
    window.location.href = data.url
  }

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
        onClick={handleCheckout}
        disabled={processing}
      >
        {processing ? t('checkout.redirecting') : t('checkout.placeOrder')}
      </button>

      {errorKey && <p className="checkout-error">{t(errorKey)}</p>}
    </div>
  )
}

export default Checkout
