// src/lib/categoryName.js
//
// Nome da mostrare per una categoria, nella lingua corrente.
//
// Le 5 categorie "storiche" (create da schema_categories.sql) hanno una
// traduzione vera e propria nei file src/locales/*.json (chiave
// "categories.<slug>"): quella resta sempre la fonte principale, letta con
// t(`categories.${slug}`, { defaultValue: ... }) nei componenti.
//
// Il "defaultValue" qui sotto è il ripiego usato quando quella chiave non
// esiste — in pratica, per QUALUNQUE categoria creata dalla sezione
// "Categorie" del pannello admin: non può avere una voce nei file di
// traduzione statici (sono bundle JS, editabili solo nel codice sorgente e
// da un redeploy), quindi il nome mostrato arriva direttamente dal
// database, scegliendo la colonna giusta in base alla lingua corrente.
export function getCategoryFallbackName(category, language) {
  if (!category) return ''
  if (language?.startsWith('en') && category.name_en) {
    return category.name_en
  }
  return category.name
}
