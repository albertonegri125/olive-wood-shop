// src/pages/Home.jsx
//
// Pagina principale del sito.
// - Hero a due colonne: foto grande + testo (badge, value proposition, CTA),
//   per mostrare fin da subito il legno d'ulivo lavorato a mano, non solo
//   raccontarlo a parole.
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
import { IconSketchWood, IconSketchChisel, IconSketchOil } from '../components/icons'
import './Home.css'

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

      const { data, error: supabaseError } = await supabase
        .from('products')
        .select('*')
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

  return (
    <div className="home-page">
      {/* --- Sezione Hero ---
          Su mobile la foto viene prima del testo (ordine naturale nel
          markup); da tablet in su, tramite CSS "order", il testo passa a
          sinistra e la foto a destra, senza duplicare il markup. */}
      <section className="hero-section">
        <div className="hero-photo">
          {/* Foto segnaposto: verrà sostituita con scatti veri del laboratorio. */}
          <img
            className="hero-photo-image"
            src="https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1200"
            alt={t('hero.photoAlt')}
          />
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
