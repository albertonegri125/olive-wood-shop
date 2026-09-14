// src/lib/imageResize.js
//
// Ridimensiona un'immagine LATO CLIENT, prima di caricarla su Supabase
// Storage: riduce peso del file e tempo di caricamento del sito (le foto
// scattate con uno smartphone possono pesare diversi MB e superare di
// gran lunga la dimensione utile su schermo). Usa l'API Canvas nativa del
// browser: nessuna libreria esterna da scaricare.

// Dimensione massima (in pixel) del lato più lungo dell'immagine, e qualità
// di ricompressione JPEG: valori pensati per foto prodotto su un e-commerce
// (nitide anche a schermo intero, ma senza pesare inutilmente).
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.85

// Restituisce una Promise che si risolve con un Blob JPEG ridimensionato
// (l'immagine viene sempre ricodificata in JPEG, anche se il file di
// partenza era PNG/WebP/ecc.: per foto prodotto reali va benissimo, e
// semplifica l'estensione del file da usare per il nome su Storage).
export function resizeImageForUpload(file, maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      let { width, height } = image

      // Ridimensiona solo se necessario, mantenendo le proporzioni
      // originali: il lato più lungo diventa "maxDimension", l'altro si
      // adatta di conseguenza.
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height / width) * maxDimension)
          width = maxDimension
        } else {
          width = Math.round((width / height) * maxDimension)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl)
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("Impossibile generare l'immagine ridimensionata"))
          }
        },
        'image/jpeg',
        quality
      )
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Impossibile leggere il file immagine'))
    }

    image.src = objectUrl
  })
}
