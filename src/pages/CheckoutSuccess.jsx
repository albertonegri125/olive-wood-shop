// src/pages/CheckoutSuccess.jsx
//
// Pagina di arrivo dopo un pagamento Stripe andato a buon fine
// (/checkout/success?session_id=..., vedi success_url in
// create-checkout-session). Svuota il carrello e mostra un messaggio di
// ringraziamento.
//
// NOTA: la creazione VERA dell'ordine (riga in "orders"/"order_items",
// scalo dello stock) avviene nel webhook "stripe-webhook", non qui: questa
// pagina è solo una conferma visiva per l'utente. Il webhook di solito è
// pressoché istantaneo, ma non è garantito che abbia già finito di
// scrivere nel database nell'esatto momento in cui il browser arriva su
// questa pagina — per questo non proviamo a recuperare/mostrare qui i
// dettagli dell'ordine appena creato: l'utente li troverà a breve nella
// sua pagina "I tuoi ordini".

import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../context/CartContext'
import './CheckoutResult.css'

function CheckoutSuccess() {
  const { t } = useTranslation()
  const { clearCart } = useCart()

  // Svuotiamo il carrello una sola volta, al primo render: non deve
  // ripetersi a ogni re-render della pagina (es. cambio lingua).
  const hasCleared = useRef(false)
  useEffect(() => {
    if (hasCleared.current) return
    hasCleared.current = true
    clearCart()
  }, [clearCart])

  return (
    <div className="checkout-result-page">
      <div className="checkout-result-card checkout-result-success">
        <span className="checkout-result-icon" aria-hidden="true">
          ✓
        </span>
        <h1 className="checkout-result-title">{t('checkout.success.title')}</h1>
        <p className="checkout-result-text">{t('checkout.success.message')}</p>
        <div className="checkout-result-actions">
          <Link to="/account" className="btn-primary">
            {t('checkout.success.ordersLink')}
          </Link>
          <Link to="/shop" className="checkout-result-secondary-link">
            {t('cart.goToShop')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default CheckoutSuccess
