// src/pages/Home.jsx
//
// Pagina principale del sito.
// - Hero a due colonne: carosello di foto prodotto reali (fallback su un
//   placeholder solo se il catalogo non ha ancora abbastanza foto) + testo
//   (badge, value proposition, CTA), per mostrare fin da subito il legno
//   d'ulivo lavorato a mano, non solo raccontarlo a parole.
// - Sezione "Il nostro processo": 3 colonne con numero scritto a mano
//   (01/02/03) e una piccola illustrazione a schizzo per ciascun passaggio,
//   pensata per raccontare il lavoro artigianale PRIMA che l'utente veda i
//   prodotti, così arriva alla vetrina già "educato" sul valore del pezzo.
// - Griglia con i primi 4 prodotti in evidenza, letti da Supabase.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import ProductCard from '../components/ProductCard'
import StarRating from '../components/StarRating'
import { IconSketchWood, IconSketchChisel, IconSketchOil } from '../components/icons'
import './Home.css'

// Quante testimonianze mostrare al massimo nella sezione "Cosa dicono di noi".
const TESTIMONIALS_LIMIT = 3

// --- Carosello foto hero -----------------------------------------------
// Placeholder mostrato SOLO se il catalogo non ha ancora nessun prodotto
// attivo con una foto: non deve mai apparire un'immagine rotta, quindi
// resta come primissimo valore di "heroImages" finché la query non
// restituisce foto vere (o per sempre, se il negozio è vuoto).
const HERO_PLACEHOLDER_URL = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1200'
// Quanti prodotti recenti pescare prima di mescolarli: un pool più ampio
// delle 5 foto che poi mostriamo, così il carosello non è sempre
// esattamente "i 5 più recenti" nello stesso ordine a ogni visita.
const HERO_CANDIDATE_POOL_SIZE = 12
const HERO_IMAGES_LIMIT = 5
const HERO_ROTATE_INTERVAL_MS = 4500

// Le tre fasi del processo artigianale raccontate nella sezione dedicata:
// titolo e testo arrivano da locales/*.json, qui basta abbinare icona e
// una piccola rotazione diversa per ciascun numero decorativo, così i tre
// "01 02 03" non sembrano tre copie identiche ma tre numeri scritti a mano
// in momenti diversi.
const PROCESS_STEPS = [
  { key: 'step1', Icon: IconSketchWood, rotation: -3 },
  { key: 'step2', Icon: IconSketchChisel, rotation: 2 },
  { key: 'step3', Icon: IconSketchOil, rotation: -1.5 },
]

function Home() {
  const { t } = useTranslation()

  // --- Carosello foto hero ---------------------------------------------
  // Parte già con il placeholder come unico elemento: se la query sotto
  // fallisce, non restituisce nulla, o il negozio non ha ancora prodotti
  // attivi con foto, l'hero mostra comunque quello invece di restare
  // vuota o mostrare un'immagine rotta (punto 3 della richiesta).
  const [heroImages, setHeroImages] = useState([
    { id: 'placeholder', url: HERO_PLACEHOLDER_URL, name: null },
  ])
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    async function fetchHeroImages() {
      // "image_url" del prodotto è sempre allineato alla sua foto
      // principale (prima foto della galleria in product_images, vedi
      // Admin.jsx): non serve interrogare product_images a parte, questo
      // singolo campo basta già per il carosello.
      const { data, error } = await supabase
        .from('products')
        .select('id, name, image_url')
        .eq('active', true)
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(HERO_CANDIDATE_POOL_SIZE)

      if (error) {
        // Non blocchiamo la pagina per questo: l'hero resta sul
        // placeholder già impostato come stato iniziale.
        console.error(error)
        return
      }

      const candidates = data ?? []
      if (candidates.length === 0) return

      // Con una sola foto reale disponibile, niente carosello: la
      // mostriamo comunque (è pur sempre una foto vera, meglio del
      // placeholder), ma senza rotazione né puntini.
      if (candidates.length === 1) {
        setHeroImages([{ id: candidates[0].id, url: candidates[0].image_url, name: candidates[0].name }])
        return
      }

      // "a caso": mescoliamo il pool di candidati (i più recenti) invece
      // di mostrare sempre gli stessi 5 nello stesso ordine a ogni visita.
      const shuffled = [...candidates].sort(() => Math.random() - 0.5)
      setHeroImages(
        shuffled
          .slice(0, HERO_IMAGES_LIMIT)
          .map((product) => ({ id: product.id, url: product.image_url, name: product.name }))
      )
    }

    fetchHeroImages()
  }, [])

  // Rotazione automatica: solo se ci sono almeno 2 foto (punto 3). Il
  // timer riparte da capo ogni volta che cambia l'elenco di foto (es. dal
  // placeholder iniziale alle foto vere appena arrivate).
  useEffect(() => {
    if (heroImages.length <= 1) return

    const intervalId = setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroImages.length)
    }, HERO_ROTATE_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [heroImages])

  // Elenco dei prodotti in evidenza da mostrare dopo la sezione "processo"
  const [featuredProducts, setFeaturedProducts] = useState([])
  // true finché la richiesta a Supabase è in corso
  const [loading, setLoading] = useState(true)
  // Conserviamo la CHIAVE di traduzione dell'errore (non il testo già tradotto):
  // così, se l'utente cambia lingua dopo che è comparso un errore, il messaggio
  // si traduce di nuovo insieme al resto dell'interfaccia.
  const [errorKey, setErrorKey] = useState(null)

  // Al montaggio del componente, andiamo a prendere i primi 4 prodotti
  // dalla tabella "products", ordinati per data di creazione.
  useEffect(() => {
    async function fetchFeaturedProducts() {
      setLoading(true)
      setErrorKey(null)

      // "categories(...)" sfrutta la relazione (category_id -> categories.id)
      // per farsi restituire anche nome/slug della categoria di ogni
      // prodotto: serve al piccolo badge categoria mostrato da ProductCard
      // sull'angolo dell'immagine.
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select('*, categories(id, name, slug)')
        .eq('active', true)
        .order('created_at')
        .limit(4)

      if (supabaseError) {
        setErrorKey('featured.error')
        console.error(supabaseError)
      } else {
        setFeaturedProducts(data ?? [])
      }

      setLoading(false)
    }

    fetchFeaturedProducts()
  }, [])

  // --- Testimonianze in evidenza (riprova sociale) ---
  // Riusa le stesse recensioni approvate mostrate in ProductDetail, ma
  // pescate da qualunque prodotto: le più recenti, in un piccolo numero
  // fisso. Se non ce n'è ancora nessuna, la sezione semplicemente non
  // compare (niente placeholder finti).
  const [testimonials, setTestimonials] = useState([])
  const [loadingTestimonials, setLoadingTestimonials] = useState(true)

  useEffect(() => {
    async function fetchTestimonials() {
      setLoadingTestimonials(true)

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(TESTIMONIALS_LIMIT)

      if (error) {
        // Non è una sezione critica per l'uso del sito: in caso di errore
        // la nascondiamo semplicemente, senza un messaggio d'errore a video.
        console.error(error)
        setTestimonials([])
      } else {
        setTestimonials(data ?? [])
      }

      setLoadingTestimonials(false)
    }

    fetchTestimonials()
  }, [])

  return (
    <div className="home-page">
      {/* --- Sezione Hero ---
          Su mobile la foto viene prima del testo (ordine naturale nel
          markup); da tablet in su, tramite CSS "order", il testo passa a
          sinistra e la foto a destra, senza duplicare il markup. */}
      <section className="hero-section">
        <div className="hero-photo">
          {/* Tutte le foto sono montate insieme fin da subito (solo quella
              attiva è visibile, le altre restano a opacity 0): il browser
              le carica tutte appena arrivano dalla query, così il cambio
              foto è una semplice dissolvenza CSS, mai un nuovo
              caricamento di rete che farebbe lampeggiare di bianco. */}
          <div className="hero-carousel">
            {heroImages.map((image, index) => (
              <img
                key={image.id}
                className={
                  index === heroIndex
                    ? 'hero-photo-image hero-carousel-image hero-carousel-image-active'
                    : 'hero-photo-image hero-carousel-image'
                }
                src={image.url}
                alt={image.name ?? t('hero.photoAlt')}
                aria-hidden={index === heroIndex ? undefined : true}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            ))}
          </div>

          {/* Puntini cliccabili: solo se c'è più di una foto nel ciclo
              (punto 3: con una foto sola, o il placeholder, niente
              indicatori di un carosello che di fatto non ruota). */}
          {heroImages.length > 1 && (
            <div className="hero-carousel-dots" role="tablist" aria-label={t('hero.carouselLabel')}>
              {heroImages.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  role="tab"
                  aria-selected={index === heroIndex}
                  aria-label={t('hero.carouselDotLabel', { number: index + 1 })}
                  className={
                    index === heroIndex ? 'hero-carousel-dot hero-carousel-dot-active' : 'hero-carousel-dot'
                  }
                  onClick={() => setHeroIndex(index)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="hero-copy">
          <span className="eyebrow eyebrow-tag hero-badge">{t('hero.badge')}</span>
          <h1 className="hero-title">{t('hero.title')}</h1>
          <p className="hero-subtitle">{t('hero.subtitle')}</p>

          {/* Bottone primario riutilizzato in tutto il sito (.btn-primary, definito in index.css) */}
          <Link to="/shop" className="btn-primary hero-button">
            {t('hero.cta')}
          </Link>
        </div>
      </section>

      {/* --- Sezione "Il nostro processo" ---
          Racconta materiale, lavorazione e finitura PRIMA dei prodotti:
          quando l'utente arriva alla vetrina, ha già capito perché ogni
          pezzo vale il suo prezzo. Nessun contenitore bianco: la sezione
          si fonde con lo sfondo texturizzato del resto della pagina. */}
      <section className="process-section">
        <h2 className="process-title">{t('process.title')}</h2>
        <ol className="process-steps">
          {PROCESS_STEPS.map(({ key, Icon, rotation }, index) => (
            <li className="process-step" key={key}>
              <div className="process-step-visual">
                {/* Numero scritto a mano (font Caveat), ruotato in modo
                    leggermente diverso per ogni step: non sono tre copie
                    identiche, sembrano tre numeri scritti al volo. */}
                <span
                  className="process-step-number"
                  style={{ transform: `rotate(${rotation}deg)` }}
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Icon className="process-step-icon" />
              </div>
              <h3 className="process-step-title">{t(`process.${key}.title`)}</h3>
              <p className="process-step-text">{t(`process.${key}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Sezione "Cosa dicono di noi" (testimonianze) ---
          Riprova sociale, mostrata PRIMA della vetrina prodotti: chi arriva
          fin qui vede che altre persone hanno già acquistato e sono
          rimaste soddisfatte, prima ancora di scegliere un pezzo.
          Se non ci sono ancora recensioni approvate, niente sezione vuota. */}
      {!loadingTestimonials && testimonials.length > 0 && (
        <section className="testimonials-section">
          <h2 className="testimonials-title">{t('testimonials.title')}</h2>
          <div className="testimonials-grid">
            {testimonials.map((review) => (
              <figure className="testimonial-card" key={review.id}>
                <StarRating rating={review.rating} />
                {review.comment && (
                  <blockquote className="testimonial-quote">“{review.comment}”</blockquote>
                )}
                <figcaption className="testimonial-name">— {review.customer_name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* --- Sezione prodotti in evidenza --- */}
      <section className="featured-section">
        <h2 className="featured-title">{t('featured.title')}</h2>

        {loading && <p className="featured-message">{t('featured.loading')}</p>}

        {!loading && errorKey && <p className="featured-message">{t(errorKey)}</p>}

        {!loading && !errorKey && featuredProducts.length === 0 && (
          <p className="featured-message">{t('featured.empty')}</p>
        )}

        {!loading && !errorKey && featuredProducts.length > 0 && (
          <div className="featured-grid">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Home
