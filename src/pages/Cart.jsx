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
  const { cart, removeFromCart, updateQuantity, getTotal } = useCart()

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

      {/* Riepilogo in fondo alla pagina: totale complessivo + CTA checkout.
          Il checkout vero e proprio (pagamento) verrà implementato in uno
          step successivo: per ora il bottone porta a una pagina segnaposto. */}
      <div className="cart-summary">
        <div className="cart-summary-row">
          <span className="cart-summary-label">{t('cart.total')}</span>
          <span className="cart-summary-total">{formatPrice(getTotal())}</span>
        </div>
        <Link to="/checkout" className="btn-primary cart-checkout-button">
          {t('cart.checkout')}
        </Link>
      </div>
    </div>
  )
}

export default Cart
