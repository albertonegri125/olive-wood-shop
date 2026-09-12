// src/pages/Shop.jsx
//
// Pagina del negozio: mostra TUTTI i prodotti presenti nella tabella
// "products" di Supabase, in una griglia responsive.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import ProductCard from '../components/ProductCard'
import './Shop.css'

function Shop() {
  const { t } = useTranslation()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  // Conserviamo la CHIAVE di traduzione dell'errore (non il testo già tradotto):
  // se l'utente cambia lingua mentre l'errore è a schermo, si ritraduce da solo.
  const [errorKey, setErrorKey] = useState(null)

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      setErrorKey(null)

      // Prendiamo tutti i prodotti, ordinati per data di creazione
      // (i più vecchi/nuovi per primi, a seconda dell'ordine di inserimento).
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select('*')
        .order('created_at')

      if (supabaseError) {
        setErrorKey('shop.error')
        console.error(supabaseError)
      } else {
        setProducts(data ?? [])
      }

      setLoading(false)
    }

    fetchProducts()
  }, [])

  return (
    <div className="shop-page">
      <h1 className="shop-title">{t('shop.title')}</h1>

      {/* Messaggio di caricamento mentre aspettiamo la risposta da Supabase */}
      {loading && <p className="shop-message">{t('shop.loading')}</p>}

      {/* Messaggio di errore, se la richiesta a Supabase fallisce */}
      {!loading && errorKey && <p className="shop-message">{t(errorKey)}</p>}

      {/* Messaggio se la richiesta va a buon fine ma non ci sono prodotti */}
      {!loading && !errorKey && products.length === 0 && (
        <p className="shop-message">{t('shop.empty')}</p>
      )}

      {/* Griglia dei prodotti: 1 colonna su mobile, 2-3 colonne su schermi più larghi */}
      {!loading && !errorKey && products.length > 0 && (
        <div className="shop-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Shop
