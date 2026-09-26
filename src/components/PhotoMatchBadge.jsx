// src/components/PhotoMatchBadge.jsx
//
// Badge "Pezzo esatto in foto" / "Pezzo simile alla foto", in base al campo
// "photo_match_type" del prodotto (vedi schema_products_photo_match.sql).
// Usato sia in ProductCard (solo il badge, per non affollare la card) sia in
// ProductDetail (badge + testo esplicativo sotto, con "showDescription").
//
// Qualunque valore diverso da 'exact' (incluso undefined, se la migrazione
// non è ancora stata eseguita) è trattato come 'similar': è il messaggio
// più prudente da mostrare al cliente.

import { useTranslation } from 'react-i18next'
import { IconCheck, IconInfo } from './icons'
import './PhotoMatchBadge.css'

function PhotoMatchBadge({ type, showDescription = false }) {
  const { t } = useTranslation()
  const isExact = type === 'exact'
  const variant = isExact ? 'exact' : 'similar'
  const Icon = isExact ? IconCheck : IconInfo

  return (
    <div className="photo-match">
      <span className={`photo-match-badge photo-match-badge-${variant}`}>
        <Icon className="photo-match-icon" />
        {t(`photoMatch.${variant}.badge`)}
      </span>
      {showDescription && <p className="photo-match-text">{t(`photoMatch.${variant}.text`)}</p>}
    </div>
  )
}

export default PhotoMatchBadge
