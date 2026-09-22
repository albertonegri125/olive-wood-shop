// src/lib/slugify.js
//
// Trasforma un testo in uno slug "url-friendly" (es. "Tagliere Grande" ->
// "tagliere-grande"), rimuovendo accenti e caratteri non alfanumerici.
// Usata per pre-compilare lo slug quando si digita il nome di un nuovo
// prodotto (Admin.jsx) o di una nuova categoria (AdminCategories.jsx).

export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rimuove i segni diacritici (es. à -> a)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
