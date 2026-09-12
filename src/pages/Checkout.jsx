// src/pages/Checkout.jsx
//
// Pagina di checkout: per ora è solo un segnaposto (la pagina Carrello vi
// rimanda cliccando "Procedi al pagamento"). L'integrazione vera con Stripe
// e il completamento dell'ordine verranno implementati in uno step successivo.

import { useTranslation } from 'react-i18next'
import './Checkout.css'

function Checkout() {
  const { t } = useTranslation()

  return (
    <div className="checkout-page">
      <h1 className="checkout-title">{t('checkout.title')}</h1>
      <p className="checkout-placeholder">{t('checkout.comingSoon')}</p>
    </div>
  )
}

export default Checkout
