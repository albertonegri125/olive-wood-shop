// src/pages/Cart.jsx
//
// Pagina del carrello (/cart): mostra gli articoli aggiunti tramite
// CartContext, permette di cambiarne la quantità o rimuoverli, e mostra
// il totale complessivo con il bottone per procedere al pagamento.

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../context/CartContext'
import { IconTrash } from '../components/icons'
import './Cart.css'

// Formattiamo i prezzi come valuta in euro (stessa logica usata nelle
// altre pagine del negozio, es. Shop e ProductDetail).
function formatPrice(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function Cart() {
  const { t } = useTranslation()
  const { cart, removeFromCart, updateQuantity, getTotal, getDiscountPercentage, getDiscountedTotal } =
    useCart()

  // Il carrello ha sempre una sola riga per prodotto (vedi CartContext):
  // il numero di righe è quindi già il numero di prodotti DIVERSI.
  const distinctProductsCount = cart.length
  const discountPercentage = getDiscountPercentage()
  const total = getTotal()
  const discountedTotal = getDiscountedTotal()

  // --- Carrello vuoto: messaggio + invito a tornare al negozio ---
  if (cart.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <h1 className="cart-empty-title">{t('cart.title')}</h1>
          <p className="cart-empty-message">{t('cart.empty')}</p>
          <Link to="/shop" className="btn-primary">
            {t('cart.goToShop')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <h1 className="cart-title">{t('cart.title')}</h1>

      <ul className="cart-list">
        {cart.map((item) => (
          <li className="cart-item" key={item.product_id}>
            <img className="cart-item-image" src={item.image_url} alt={item.name} />

            <div className="cart-item-info">
              <span className="cart-item-name">{item.name}</span>
              <span className="cart-item-unit-price">{formatPrice(item.price)}</span>
            </div>

            <div className="cart-item-controls">
              {/* Selettore quantità: i bottoni +/- restano disabilitati
                  appena si tocca il minimo (1) o lo stock disponibile,
                  così non è possibile ordinare più pezzi di quanti ce ne siano. */}
              <div className="cart-item-quantity">
                <button
                  type="button"
                  className="cart-quantity-button"
                  onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  aria-label={t('cart.decreaseQuantity')}
                >
                  −
                </button>
                <span className="cart-quantity-value">{item.quantity}</span>
                <button
                  type="button"
                  className="cart-quantity-button"
                  onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                  disabled={item.quantity >= item.stock_disponibile}
                  aria-label={t('cart.increaseQuantity')}
                >
                  +
                </button>
              </div>

              {/* Prezzo totale della riga: prezzo unitario * quantità */}
              <span className="cart-item-row-total">
                {formatPrice(item.price * item.quantity)}
              </span>

              <button
                type="button"
                className="cart-item-remove"
                onClick={() => removeFromCart(item.product_id)}
                aria-label={t('cart.remove')}
              >
                <IconTrash />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Riepilogo in fondo alla pagina: numero di prodotti diversi, sconto
          bundle (o messaggio incentivante se non ancora raggiunto), totale
          (scontato, con quello pieno barrato accanto per trasparenza) e CTA
          checkout. Il checkout vero e proprio (pagamento) verrà implementato
          in uno step successivo: per ora il bottone porta a una pagina
          segnaposto. */}
      <div className="cart-summary">
        {/* Tutto il "riepilogo informativo" è raggruppato in un unico
            contenitore (invece di essere figlio diretto di .cart-summary)
            così da tablet in su, quando .cart-summary diventa una riga
            (info a sinistra, bottone a destra), i vari elementi restano
            impilati verticalmente qui dentro invece di allinearsi tutti
            sulla stessa riga. */}
        <div className="cart-summary-info">
          <p className="cart-products-count">
            {t('cart.distinctProductsCount', { count: distinctProductsCount })}
          </p>

          {/* Sconto già applicato: badge in accento verde con la percentuale,
              più l'importo risparmiato. Compare da 2 prodotti diversi in su. */}
          {discountPercentage > 0 && (
            <div className="cart-discount-row">
              <span className="cart-discount-badge">
                {t('cart.bundleDiscount', { percentage: discountPercentage })}
              </span>
              <span className="cart-discount-amount">−{formatPrice(total - discountedTotal)}</span>
            </div>
          )}

          {/* Messaggio incentivante: con 1 solo prodotto invita ad aggiungerne
              un secondo (con link diretto al negozio); con 2 prodotti (che
              hanno già il 10% di sconto qui sopra) invita ad aggiungerne un
              terzo per salire al 15%. Con 3+ prodotti si è già al tetto
              massimo, quindi nessun messaggio ulteriore. */}
          {distinctProductsCount === 1 && (
            <p className="cart-incentive">
              {t('cart.incentiveAddSecond')}{' '}
              <Link to="/shop" className="cart-incentive-link">
                {t('cart.goToShop')}
              </Link>
            </p>
          )}
          {distinctProductsCount === 2 && (
            <p className="cart-incentive">{t('cart.incentiveAddThird')}</p>
          )}

          <div className="cart-summary-row">
            <span className="cart-summary-label">{t('cart.total')}</span>
            <span className="cart-summary-total-wrapper">
              {/* Totale pieno barrato: mostrato solo se lo sconto è
                  applicato, per trasparenza su quanto si sta risparmiando. */}
              {discountPercentage > 0 && (
                <span className="cart-summary-total-original">{formatPrice(total)}</span>
              )}
              <span className="cart-summary-total">{formatPrice(discountedTotal)}</span>
            </span>
          </div>
        </div>

        <Link to="/checkout" className="btn-primary cart-checkout-button">
          {t('cart.checkout')}
        </Link>
      </div>
    </div>
  )
}

export default Cart
