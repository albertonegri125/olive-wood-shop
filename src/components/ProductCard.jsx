// src/components/ProductCard.jsx
//
// "Scheda" riassuntiva di un singolo prodotto, pensata per essere ripetuta
// dentro una griglia (usata sia in Home che in Shop).
//
// Gerarchia visiva pensata per valorizzare il pezzo PRIMA del prezzo:
// immagine grande e dominante -> nome in serif -> badge "pezzo unico"
// (materiale/lavorazione) -> solo in fondo, in dimensione normale, il
// prezzo insieme al bottone "Aggiungi al carrello".
//
// - Se il prodotto è esaurito (stock === 0), niente più link alla pagina
//   di dettaglio e il bottone è disabilitato con scritta "Esaurito".
// - Se restano pochi pezzi (stock 1 o 2), un badge ambra "Ultimo pezzo"
//   compare sopra l'immagine (colore tenue, non allarmante).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../context/CartContext'
import { IconUnique } from './icons'
import './ProductCard.css'

function ProductCard({ product }) {
  const { t } = useTranslation()
  const { addToCart } = useCart()
  const { name, price, image_url: imageUrl, stock, slug } = product

  // Controlla se mostrare il feedback "Aggiunto ✓" al posto del testo
  // normale del bottone, subito dopo un click su "Aggiungi al carrello".
  const [justAdded, setJustAdded] = useState(false)

  const isOutOfStock = stock === 0
  // "Scorte basse": 1 o 2 pezzi rimasti (ma non esaurito).
  const isLowStock = stock > 0 && stock <= 2

  // Formattiamo il prezzo come valuta in euro, in modo leggibile
  // (es. 1234.5 -> "1.234,50 €"), usando le API di formattazione del browser.
  const formattedPrice = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(price)

  // Dopo aver mostrato il feedback "Aggiunto ✓" per 1,5 secondi, il bottone
  // torna al suo testo normale. Il timeout viene ripulito se il componente
  // viene smontato nel frattempo, per evitare di aggiornare lo stato di un
  // componente non più a schermo.
  useEffect(() => {
    if (!justAdded) return undefined

    const timeoutId = setTimeout(() => setJustAdded(false), 1500)
    return () => clearTimeout(timeoutId)
  }, [justAdded])

  // Aggiunge il prodotto al carrello condiviso (CartContext) e mostra un
  // breve feedback visivo sul bottone, per confermare che l'azione è avvenuta.
  function handleAddToCart() {
    addToCart(product)
    setJustAdded(true)
  }

  // L'immagine e il nome sono due link separati verso la pagina di dettaglio
  // (pattern comune nell'e-commerce): così il bottone "Aggiungi al carrello"
  // può restare un <button> vero e proprio, senza annidarlo dentro un <a>
  // (non valido in HTML e problematico per l'accessibilità).
  const MediaTag = isOutOfStock ? 'div' : Link
  const InfoTag = isOutOfStock ? 'div' : Link
  const linkProps = isOutOfStock ? {} : { to: `/shop/${slug}` }

  return (
    <div className={isOutOfStock ? 'product-card product-card-disabled' : 'product-card'}>
      {/* Immagine grande e dominante: è il primo elemento che si vede */}
      <MediaTag className="product-card-media" {...linkProps}>
        <img
          className="product-card-image"
          src={imageUrl}
          alt={name}
          loading="lazy"
        />
        {/* Badge "Esaurito", ben visibile, in alto a destra */}
        {isOutOfStock && (
          <span className="product-card-badge product-card-badge-out">
            {t('product.outOfStock')}
          </span>
        )}
        {/* Badge di scarsità: solo se il prodotto è ancora acquistabile
            ma restano 1 o 2 pezzi. Colore ambra tenue, non allarmante. */}
        {isLowStock && (
          <span className="product-card-badge product-card-badge-low">
            {t('product.lastOne')}
          </span>
        )}
      </MediaTag>

      <div className="product-card-body">
        {/* Nome del prodotto in font serif */}
        <InfoTag className="product-card-info" {...linkProps}>
          <h3 className="product-card-name">{name}</h3>
          {/* Riga sottile che comunica l'unicità del pezzo: rinforza il
              valore artigianale ancora prima che l'occhio arrivi al prezzo. */}
          <p className="product-card-unique">
            <IconUnique className="product-card-unique-icon" />
            {t('trust.unique')}
          </p>
        </InfoTag>

        {/* In fondo alla card: prezzo (sinistra, dimensione normale) e
            bottone "Aggiungi al carrello" (destra), sulla stessa riga. */}
        <div className="product-card-footer">
          {isOutOfStock ? (
            <span className="product-card-price product-card-price-muted">
              {t('product.outOfStock')}
            </span>
          ) : (
            <span className="product-card-price">{formattedPrice}</span>
          )}
          <button
            type="button"
            className="btn-primary btn-sm product-card-add-button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
          >
            {isOutOfStock
              ? t('product.outOfStock')
              : justAdded
                ? t('product.added')
                : t('product.addToCart')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductCard
