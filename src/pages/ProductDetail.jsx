// src/pages/ProductDetail.jsx
//
// Pagina di dettaglio di un singolo prodotto, identificato dallo "slug"
// presente nell'URL (es. /shop/tagliere-ulivo).
//
// Gerarchia visiva pensata per valorizzare il pezzo PRIMA del prezzo:
// badge "pezzo unico" -> nome grande in serif -> descrizione -> box con le
// icone di fiducia -> prezzo (dimensione media, mai il testo più grande
// della pagina) -> bottone "Aggiungi al carrello" -> mini racconto del
// processo artigianale specifico per questo pezzo.

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useCart } from '../context/CartContext'
import {
  IconSketchWood,
  IconSketchChisel,
  IconSketchOil,
} from '../components/icons'
import StarRating from '../components/StarRating'
import PhotoMatchBadge from '../components/PhotoMatchBadge'
import './ProductDetail.css'

// Le tre fasi del processo artigianale, riproposte qui in versione compatta
// (stesse chiavi di traduzione e stesse icone "a schizzo" della sezione
// "Il nostro processo" nella Home, per coerenza visiva).
const PROCESS_STEPS = [
  { key: 'step1', Icon: IconSketchWood },
  { key: 'step2', Icon: IconSketchChisel },
  { key: 'step3', Icon: IconSketchOil },
]

function ProductDetail() {
  // Leggiamo lo slug direttamente dall'URL grazie a react-router
  // (deve corrispondere al parametro ":slug" definito nella route in App.jsx)
  const { slug } = useParams()
  const { t, i18n } = useTranslation()
  const { addToCart } = useCart()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  // Conserviamo la CHIAVE di traduzione dell'errore (non il testo già tradotto):
  // se l'utente cambia lingua mentre l'errore è a schermo, si ritraduce da solo.
  const [errorKey, setErrorKey] = useState(null)

  // Controlla se la lightbox (immagine ingrandita a schermo intero) è aperta
  const [isZoomOpen, setIsZoomOpen] = useState(false)

  // Controlla se mostrare la barra sticky mobile con il bottone "Aggiungi al
  // carrello": deve comparire solo DOPO che l'immagine principale è uscita
  // dalla vista durante lo scroll (non subito, altrimenti coprirebbe l'immagine).
  const [showStickyBar, setShowStickyBar] = useState(false)
  const imageRef = useRef(null)

  // Controlla se mostrare il feedback "Aggiunto ✓" al posto del testo
  // normale del bottone, subito dopo un click su "Aggiungi al carrello".
  const [justAdded, setJustAdded] = useState(false)

  // Ogni volta che cambia lo slug nell'URL, rifacciamo la query a Supabase
  // per caricare il prodotto corrispondente.
  useEffect(() => {
    async function fetchProduct() {
      setLoading(true)
      setErrorKey(null)
      setProduct(null)

      // .eq('slug', slug) filtra per lo slug richiesto,
      // .single() ci dice che ci aspettiamo esattamente una riga di risultato.
      // "categories(...)" sfrutta la relazione (category_id -> categories.id)
      // per farsi restituire anche nome/slug della categoria, se impostata
      // (null per un prodotto senza categoria: retrocompatibile).
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select('*, categories(id, name, slug)')
        .eq('slug', slug)
        .eq('active', true)
        .single()

      if (supabaseError) {
        setErrorKey('productDetail.notFound')
        console.error(supabaseError)
      } else {
        setProduct(data)
      }

      setLoading(false)
    }

    fetchProduct()
  }, [slug])

  // --- Recensioni clienti (riprova sociale) ---
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(true)

  // Una volta noto l'id del prodotto (dopo il fetch sopra), carichiamo le
  // sue recensioni GIÀ APPROVATE (vedi schema_reviews.sql: quelle non
  // ancora moderate non sono comunque leggibili pubblicamente, per via
  // della Row Level Security, ma filtriamo esplicitamente anche qui).
  useEffect(() => {
    if (!product?.id) return undefined

    let isCurrent = true

    async function fetchReviews() {
      setLoadingReviews(true)

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', product.id)
        .eq('approved', true)
        .order('created_at', { ascending: false })

      if (!isCurrent) return

      if (error) {
        console.error(error)
        setReviews([])
      } else {
        setReviews(data ?? [])
      }

      setLoadingReviews(false)
    }

    fetchReviews()

    // Evita di aggiornare lo stato se l'utente cambia pagina (o prodotto)
    // prima che la richiesta sia terminata.
    return () => {
      isCurrent = false
    }
  }, [product?.id])

  // --- Galleria immagini (più foto per prodotto) ---
  // "image_url" sul prodotto resta la foto principale/di fallback: se il
  // prodotto non ha righe in "product_images" (caso comune per i prodotti
  // già esistenti, o per chi ne carica una sola), la galleria è
  // semplicemente quella singola immagine, striscia di miniature esclusa.
  const [galleryImages, setGalleryImages] = useState([])
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  useEffect(() => {
    if (!product?.id) return undefined

    let isCurrent = true

    async function fetchGallery() {
      const { data, error } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', product.id)
        .order('display_order')

      if (!isCurrent) return

      if (!error && data && data.length > 0) {
        setGalleryImages(data.map((row) => row.image_url))
      } else {
        if (error) console.error(error)
        setGalleryImages(product.image_url ? [product.image_url] : [])
      }

      // Ripartiamo sempre dalla prima foto quando cambia il prodotto (o la
      // sua galleria viene ricaricata).
      setActiveImageIndex(0)
    }

    fetchGallery()

    return () => {
      isCurrent = false
    }
  }, [product?.id, product?.image_url])

  // Osserviamo l'immagine principale con un IntersectionObserver nativo
  // (nessuna libreria esterna): quando esce dalla viewport mostriamo la
  // barra sticky mobile, quando torna visibile la nascondiamo di nuovo.
  useEffect(() => {
    const imageElement = imageRef.current
    if (!imageElement) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(imageElement)

    return () => observer.disconnect()
  }, [product])

  // Mentre la lightbox è aperta: si chiude con il tasto Escape e blocchiamo
  // lo scroll della pagina sotto, per un'esperienza da "vero" visualizzatore
  // a schermo intero (nessuna libreria: solo CSS + un po' di stato React).
  useEffect(() => {
    if (!isZoomOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsZoomOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isZoomOpen])

  // Dopo aver mostrato il feedback "Aggiunto ✓" per 1,5 secondi, il bottone
  // torna al suo testo normale. Il timeout viene ripulito se il componente
  // viene smontato nel frattempo (es. l'utente cambia pagina), per evitare
  // di aggiornare lo stato di un componente non più a schermo.
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

  // Testo del bottone "Aggiungi al carrello": tiene conto sia dello stato
  // di disponibilità del prodotto sia del feedback temporaneo "Aggiunto ✓".
  function addToCartLabel() {
    if (isOutOfStock) return t('productDetail.outOfStock')
    if (justAdded) return t('product.added')
    return t('productDetail.addToCart')
  }

  if (loading) {
    return (
      <div className="product-detail-page">
        <p className="product-detail-message">{t('productDetail.loading')}</p>
      </div>
    )
  }

  if (errorKey || !product) {
    return (
      <div className="product-detail-page">
        <p className="product-detail-message">{t(errorKey ?? 'productDetail.notFound')}</p>
      </div>
    )
  }

  const isOutOfStock = product.stock === 0
  // "Scorte basse": 1 o 2 pezzi rimasti (ma non esaurito) — stessa soglia
  // usata in ProductCard, per coerenza tra vetrina e pagina di dettaglio.
  const isLowStock = product.stock > 0 && product.stock <= 2

  const formattedPrice = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(product.price)
  const measurementFormatter = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 })
  const measurementRows = [
    { key: 'length', value: product.length_cm, unit: 'cm' },
    { key: 'width', value: product.width_cm, unit: 'cm' },
    { key: 'thickness', value: product.thickness_cm, unit: 'cm' },
    { key: 'weight', value: product.weight_g, unit: 'g' },
  ].filter(({ value }) => value !== null && value !== undefined)
  const activeLanguage = i18n.language.toLowerCase().startsWith('it') ? 'it' : 'en'
  const grainNote = (activeLanguage === 'it' ? product.grain_note_it : product.grain_note_en)?.trim() ?? ''
  const treeAgeNote = (activeLanguage === 'it' ? product.tree_age_note_it : product.tree_age_note_en)?.trim() ?? ''

  // Foto attualmente mostrata come principale (grande, zoomabile): quella
  // selezionata nella striscia di miniature, o la prima della galleria.
  const mainImageUrl = galleryImages[activeImageIndex] ?? product.image_url

  return (
    <div className="product-detail-page">
      <div className="product-detail-content">
        {/* Immagine grande del prodotto: cliccabile per aprire la lightbox */}
        <div className="product-detail-image-wrapper" ref={imageRef}>
          <button
            type="button"
            className="product-detail-image-button"
            onClick={() => setIsZoomOpen(true)}
            aria-label={t('productDetail.zoomHint')}
          >
            <img
              className="product-detail-image"
              src={mainImageUrl}
              alt={product.name}
            />
            <span className="product-detail-zoom-hint">{t('productDetail.zoomHint')}</span>
          </button>

          {/* Striscia di miniature: solo se il prodotto ha più di una
              foto. Con una sola immagine (o nessuna riga in
              product_images, il caso di un prodotto già esistente) niente
              cambia rispetto a prima. */}
          {galleryImages.length > 1 && (
            <>
              <div className="product-detail-thumbs" role="tablist" aria-label={t('productDetail.galleryLabel')}>
                {galleryImages.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    role="tab"
                    aria-selected={index === activeImageIndex}
                    className={
                      index === activeImageIndex
                        ? 'product-detail-thumb product-detail-thumb-active'
                        : 'product-detail-thumb'
                    }
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>

              <div className="product-detail-dots" aria-label={t('productDetail.galleryLabel')}>
                {galleryImages.map((url, index) => (
                  <button
                    key={`${url}-dot`}
                    type="button"
                    aria-label={t('productDetail.galleryLabel')}
                    className={
                      index === activeImageIndex
                        ? 'product-detail-dot product-detail-dot-active'
                        : 'product-detail-dot'
                    }
                    onClick={() => setActiveImageIndex(index)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Informazioni testuali del prodotto */}
        <div className="product-detail-info">
          <h1 className="product-detail-name">{product.name}</h1>
          <PhotoMatchBadge type={product.photo_match_type} showDescription />
          {/* Prezzo e pulsante restano nel primo blocco, vicini alla foto e al nome. */}
          {isOutOfStock ? (
            <p className="product-detail-status">{t('productDetail.outOfStock')}</p>
          ) : (
            <p className="product-detail-price">{formattedPrice}</p>
          )}
          <p
            className={
              isLowStock ? 'product-detail-stock product-detail-stock-low' : 'product-detail-stock'
            }
          >
            {isOutOfStock
              ? t('productDetail.unavailable')
              : isLowStock
                ? product.stock === 1
                  ? t('product.lastOne')
                  : t('product.lowStock', { count: product.stock })
                : t('productDetail.stock', { count: product.stock })}
          </p>

          {/* Il bottone è disabilitato se il prodotto è esaurito.
              Usa lo stesso bottone primario (.btn-primary) riutilizzato in tutto il sito. */}
          <button
            type="button"
            className="btn-primary product-detail-add-button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
          >
            {addToCartLabel()}
          </button>
          {product.description && (
            <p className="product-detail-description">{product.description}</p>
          )}
        </div>
      </div>

      {measurementRows.length > 0 && (
        <section className="product-detail-section product-detail-measurements">
          <h2>{t('productDetail.measurementsTitle')}</h2>
          <table>
            <tbody>
              {measurementRows.map(({ key, value, unit }) => (
                <tr key={key}>
                  <th scope="row">{t(`productDetail.measurements.${key}`)}</th>
                  <td>{measurementFormatter.format(value)} {unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {grainNote && (
        <section className="product-detail-section">
          <h2>{t('productDetail.grainTitle')}</h2>
          <p>{grainNote}</p>
        </section>
      )}

      {treeAgeNote && (
        <section className="product-detail-section">
          <h2>{t('productDetail.originTitle')}</h2>
          <p>{treeAgeNote}</p>
        </section>
      )}

      <section className="product-detail-section product-detail-care">
        <details open>
          <summary>{t('productDetail.careTitle')}</summary>
          <p>{t('productDetail.careText')}</p>
        </details>
      </section>

      {showStickyBar && (
        <div className="product-detail-sticky-bar" aria-live="polite">
          <span className="product-detail-sticky-price">{formattedPrice}</span>
          <button
            type="button"
            className="btn-primary product-detail-sticky-button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
          >
            {addToCartLabel()}
          </button>
        </div>
      )}

      {/* --- Sezione "Come nasce questo pezzo" ---
          Le stesse 3 fasi del processo raccontate in Home, qui in versione
          compatta e specifica per questo prodotto. */}
      <section className="product-detail-process">
        <h2 className="product-detail-process-title">{t('process.compactTitle')}</h2>
        <ol className="product-detail-process-steps">
          {PROCESS_STEPS.map(({ key, Icon }, index) => (
            <li className="product-detail-process-step" key={key}>
              <span className="product-detail-process-number" aria-hidden="true">
                {index + 1}
              </span>
              <Icon className="product-detail-process-icon" />
              <div>
                <h3 className="product-detail-process-step-title">
                  {t(`process.${key}.title`)}
                </h3>
                <p className="product-detail-process-step-text">
                  {t(`process.${key}.text`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {!loadingReviews && reviews.length > 0 && (
        <section className="product-detail-reviews">
          <h2 className="product-detail-reviews-title">{t('productDetail.reviews.title')}</h2>
          <div className="product-detail-reviews-list">
            {reviews.map((review) => (
              <article className="review-card" key={review.id}>
                <div className="review-card-header">
                  <StarRating rating={review.rating} />
                  <span className="review-card-name">{review.customer_name}</span>
                </div>
                {review.comment && <p className="review-card-comment">{review.comment}</p>}
                {review.photo_url && <img className="review-card-photo" src={review.photo_url} alt="" />}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Lightbox: overlay a schermo intero con l'immagine ingrandita.
          Un semplice <div> in position:fixed con un alto z-index: niente
          librerie esterne, solo CSS + lo stato "isZoomOpen". */}
      {isZoomOpen && (
        <div
          className="product-detail-lightbox"
          onClick={() => setIsZoomOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
        >
          <button
            type="button"
            className="product-detail-lightbox-close"
            onClick={() => setIsZoomOpen(false)}
            aria-label={t('productDetail.closeZoom')}
          >
            ×
          </button>
          <img
            className="product-detail-lightbox-image"
            src={mainImageUrl}
            alt={product.name}
          />
        </div>
      )}

      {/* Barra sticky in fondo allo schermo, visibile solo su mobile e solo
          dopo che l'immagine principale è uscita dalla vista durante lo
          scroll (vedi l'IntersectionObserver qui sopra). */}
      {showStickyBar && (
        <div className="product-detail-sticky-bar">
          <div className="product-detail-sticky-info">
            <span className="product-detail-sticky-name">{product.name}</span>
            {!isOutOfStock && (
              <span className="product-detail-sticky-price">{formattedPrice}</span>
            )}
          </div>
          <button
            type="button"
            className="btn-primary product-detail-sticky-button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
          >
            {addToCartLabel()}
          </button>
        </div>
      )}
    </div>
  )
}

export default ProductDetail
