// src/pages/Shop.jsx
//
// Pagina del negozio: mostra i prodotti della tabella "products" di
// Supabase, in una griglia responsive, filtrabili per categoria tramite
// una riga di tab orizzontali in alto (scrollabile su mobile).
//
// La categoria attiva vive nell'URL come query string (?category=slug),
// non solo nello stato del componente: così il filtro è condivisibile e
// il link "categoria" cliccabile in ProductDetail può riportare qui già
// filtrato, semplicemente linkando a "/shop?category=slug".

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import ProductCard from '../components/ProductCard'
import './Shop.css'

function Shop() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  // "null" significa "Tutti" (nessun filtro): non c'è ?category nell'URL.
  const activeCategorySlug = searchParams.get('category')

  // --- Categorie (per le tab) ---
  const [categories, setCategories] = useState([])

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at')

      if (error) {
        console.error(error)
      } else {
        setCategories(data ?? [])
      }
    }

    fetchCategories()
  }, [])

  // --- Prodotti (filtrati per categoria, se selezionata) ---
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  // Conserviamo la CHIAVE di traduzione dell'errore (non il testo già tradotto):
  // se l'utente cambia lingua mentre l'errore è a schermo, si ritraduce da solo.
  const [errorKey, setErrorKey] = useState(null)

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      setErrorKey(null)

      // "categories(...)" sfrutta la relazione (category_id -> categories.id)
      // per farsi restituire anche il nome/slug della categoria insieme a
      // ogni prodotto, in un'unica query: serve al badge categoria che
      // ProductCard mostra sull'immagine.
      let query = supabase
        .from('products')
        .select('*, categories(id, name, slug)')
        .order('created_at')

      if (activeCategorySlug) {
        const activeCategory = categories.find((category) => category.slug === activeCategorySlug)
        // Se la categoria nell'URL non corrisponde a nessuna di quelle
        // caricate (o le categorie non sono ancora arrivate), mostriamo
        // comunque tutti i prodotti invece di un elenco vuoto "per errore".
        if (activeCategory) {
          query = query.eq('category_id', activeCategory.id)
        }
      }

      const { data, error: supabaseError } = await query

      if (supabaseError) {
        setErrorKey('shop.error')
        console.error(supabaseError)
      } else {
        setProducts(data ?? [])
      }

      setLoading(false)
    }

    fetchProducts()
  }, [activeCategorySlug, categories])

  // Aggiorna il filtro cambiando l'URL (?category=slug, o senza il
  // parametro per "Tutti"): l'effetto sopra reagisce da solo al cambiamento.
  function handleSelectCategory(slug) {
    if (slug) {
      setSearchParams({ category: slug })
    } else {
      setSearchParams({})
    }
  }

  return (
    <div className="shop-page">
      <h1 className="shop-title">{t('shop.title')}</h1>

      {/* Tab categorie: "Tutti" + una per categoria. Riga orizzontale
          scrollabile (non va mai a capo), così funziona anche con molte
          categorie su schermi stretti. */}
      {categories.length > 0 && (
        <div className="shop-categories" role="tablist" aria-label={t('shop.categoriesLabel')}>
          <button
            type="button"
            role="tab"
            aria-selected={!activeCategorySlug}
            className={
              !activeCategorySlug ? 'shop-category-tab shop-category-tab-active' : 'shop-category-tab'
            }
            onClick={() => handleSelectCategory(null)}
          >
            {t('shop.allCategories')}
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={activeCategorySlug === category.slug}
              className={
                activeCategorySlug === category.slug
                  ? 'shop-category-tab shop-category-tab-active'
                  : 'shop-category-tab'
              }
              onClick={() => handleSelectCategory(category.slug)}
            >
              {t(`categories.${category.slug}`, { defaultValue: category.name })}
            </button>
          ))}
        </div>
      )}

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
