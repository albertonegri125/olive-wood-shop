// src/components/StarRating.jsx
//
// Riga di 5 stelline usata per mostrare il punteggio (rating 1-5) di una
// recensione cliente: nella sezione recensioni di ProductDetail e nelle
// testimonianze in evidenza della Home. Componente a parte per non
// duplicare la stessa logica nei due punti.

import { IconStar } from './icons'
import './StarRating.css'

function StarRating({ rating }) {
  return (
    // "role=img" + aria-label: per uno screen reader questo è un singolo
    // elemento ("4 stelle su 5"), non 5 icone decorative separate.
    <span className="star-rating" role="img" aria-label={`${rating} / 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <IconStar
          key={index}
          className={
            index < rating ? 'star-rating-icon star-rating-icon-filled' : 'star-rating-icon'
          }
        />
      ))}
    </span>
  )
}

export default StarRating
