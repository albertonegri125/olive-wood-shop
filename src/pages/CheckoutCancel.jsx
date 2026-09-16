// src/pages/CheckoutCancel.jsx
//
// Pagina di arrivo se l'utente annulla il pagamento su Stripe (o torna
// indietro dal checkout) invece di completarlo (/checkout/cancel, vedi
// cancel_url in create-checkout-session). Il carrello NON viene svuotato:
// il pagamento non è avvenuto, quindi gli articoli restano lì pronti per
// riprovare.

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './CheckoutResult.css'

function CheckoutCancel() {
  const { t } = useTranslation()

  return (
    <div className="checkout-result-page">
      <div className="checkout-result-card">
        <h1 className="checkout-result-title">{t('checkout.cancel.title')}</h1>
        <p className="checkout-result-text">{t('checkout.cancel.message')}</p>
        <div className="checkout-result-actions">
          <Link to="/cart" className="btn-primary">
            {t('checkout.cancel.cartLink')}
          </Link>
          <Link to="/shop" className="checkout-result-secondary-link">
            {t('cart.goToShop')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default CheckoutCancel
