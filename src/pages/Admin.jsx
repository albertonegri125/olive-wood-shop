// src/pages/Admin.jsx
//
// Pannello admin (/admin, protetto da RequireAdmin): permette di gestire il
// catalogo prodotti (creare, modificare, eliminare, aggiornare le scorte e
// caricare le foto) senza dover passare dalla dashboard di Supabase.
//
// - Lista di tutti i prodotti, con miniatura, SKU, nome, prezzo, scorte e azioni.
// - "Stampa etichetta" apre una vista stampabile 60x40mm con SKU e nome
//   (vedi lib/printLabel.js).
// - Le scorte si possono aggiornare direttamente dalla lista (input + bottone
//   "Salva" per riga), per le modifiche rapide più frequenti.
// - "Modifica" ed "Elimina" agiscono sulla riga corrispondente.
// - "Nuovo prodotto" apre lo stesso form usato per "Modifica" (vuoto).
// - Il form permette di caricare PIÙ foto per prodotto (galleria): ogni
//   immagine viene ridimensionata lato client (vedi imageResize.js, max
//   1600px sul lato lungo, JPEG qualità 85%) prima di essere caricata su
//   Supabase Storage, nel bucket pubblico "product-images" (vedi
//   schema_admin.sql per crearlo e le sue policy). L'elenco delle foto è
//   riordinabile con le frecce su/giù: la prima è quella "principale".
//   Le righe in "product_images" (vedi schema_product_images.sql) tengono
//   traccia dell'ordine; il campo "image_url" del prodotto resta sempre
//   allineato alla foto principale, per compatibilità con il codice che
//   mostra una sola immagine (es. ProductCard.jsx e la miniatura qui sotto).

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { resizeImageForUpload } from '../lib/imageResize'
import { slugify } from '../lib/slugify'
import { getCategoryFallbackName } from '../lib/categoryName'
import { printProductLabel } from '../lib/printLabel'
import AdminNav from '../components/AdminNav'
// Riusiamo gli stili dei campi di Auth.css (.auth-field, .auth-label,
// .auth-input, .auth-error): stesso aspetto dei form di Login/Registrazione,
// invece di ridefinire da capo gli stessi input anche qui.
import '../pages/Auth.css'
import './Admin.css'

// Estrae il percorso del file all'interno del bucket da un URL pubblico di
// Supabase Storage (es. ".../object/public/product-images/foto.jpg" ->
// "foto.jpg"), usato per poter eliminare il file quando si elimina il
// prodotto collegato.
function getStoragePathFromPublicUrl(url) {
  if (!url) return null
  const marker = '/product-images/'
  const index = url.indexOf(marker)
  if (index === -1) return null
  return url.slice(index + marker.length)
}

// DIAGNOSTICA: logga un errore Supabase/Postgrest con tutti i suoi campi
// (message/code/details/hint) invece del solo oggetto grezzo — in console
// un oggetto Error stampato da solo a volte non si espande automaticamente,
// rendendo poco chiaro se un'operazione è fallita per permessi RLS (in
// genere code "42501", message che cita "row-level security policy") o per
// un altro motivo (es. vincolo di validazione, colonna mancante).
function logSupabaseError(context, error) {
  console.error(`[Admin] ${context}:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  })
}

// Stato iniziale (vuoto) del form, riusato sia per "Nuovo prodotto" sia
// per resettare il form dopo il salvataggio o l'annullamento.
const EMPTY_FORM = {
  name: '',
  slug: '',
  description: '',
  price: '',
  stock: '',
  categoryId: '',
  sku: '',
  photoMatchType: 'similar',
}

// Opzioni del selettore "corrispondenza con la foto" (vedi
// schema_products_photo_match.sql), nell'ordine in cui compaiono nel form.
const PHOTO_MATCH_OPTIONS = ['exact', 'similar']

function Admin() {
  const { t, i18n } = useTranslation()

  // --- Lista prodotti -------------------------------------------------
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [listErrorKey, setListErrorKey] = useState(null)

  async function fetchProducts() {
    setLoadingProducts(true)
    setListErrorKey(null)

    const { data, error } = await supabase.from('products').select('*').order('created_at')

    if (error) {
      setListErrorKey('admin.error')
      console.error(error)
    } else {
      setProducts(data ?? [])
    }

    setLoadingProducts(false)
  }

  // "void" segnala esplicitamente che ignoriamo la Promise restituita:
  // fetchProducts() è definita fuori dall'effetto (sopra) perché viene
  // richiamata anche da altri punti della pagina (dopo un salvataggio o
  // un'eliminazione), non solo al primo caricamento.
  useEffect(() => {
    void fetchProducts()
  }, [])

  // --- Categorie (per la select nel form prodotto) ---
  // Estratta in una funzione richiamabile (non solo dentro l'effetto al
  // primo caricamento): la richiamiamo di nuovo ogni volta che si apre il
  // form (vedi openNewForm/openEditForm), così la select mostra sempre
  // l'elenco aggiornato anche se una categoria è stata aggiunta/rinominata/
  // eliminata dalla sezione "Categorie" (/admin/categorie) nel frattempo,
  // senza bisogno di un refresh manuale della pagina.
  const [categories, setCategories] = useState([])

  async function fetchCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('created_at')
    if (error) {
      logSupabaseError('Errore nel caricare le categorie', error)
    } else {
      setCategories(data ?? [])
    }
  }

  useEffect(() => {
    void fetchCategories()
  }, [])

  // --- Modifica rapida delle scorte dalla lista ------------------------
  // Valori digitati nell'input di ogni riga, tenuti separati dai prodotti
  // finché non si preme "Salva" (chiave: id prodotto, valore: stringa).
  const [stockDrafts, setStockDrafts] = useState({})
  // Id del prodotto il cui salvataggio scorte è in corso, per disabilitare
  // il bottone di quella riga soltanto (le altre restano utilizzabili).
  const [savingStockId, setSavingStockId] = useState(null)
  const [stockErrorId, setStockErrorId] = useState(null)

  function handleStockDraftChange(productId, value) {
    setStockDrafts((drafts) => ({ ...drafts, [productId]: value }))
  }

  async function handleSaveStock(product) {
    // DIAGNOSTICA TEMPORANEA: vedi commento in openNewForm.
    console.log('[Admin] Click su "Salva" scorte per il prodotto:', product.id, product.name)

    const draftValue = stockDrafts[product.id]
    const newStock = Number(draftValue)

    if (draftValue === undefined || draftValue === '' || Number.isNaN(newStock) || newStock < 0) {
      setStockErrorId(product.id)
      return
    }

    setSavingStockId(product.id)
    setStockErrorId(null)

    const { error } = await supabase.from('products').update({ stock: newStock }).eq('id', product.id)

    if (error) {
      logSupabaseError(`Errore nell'aggiornare lo stock del prodotto ${product.id}`, error)
      setStockErrorId(product.id)
    } else {
      // Aggiorniamo il prodotto direttamente nell'elenco già in memoria,
      // invece di rifare una richiesta completa a Supabase: risposta
      // visiva immediata per una modifica pensata per essere veloce.
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, stock: newStock } : item))
      )
      setStockDrafts((drafts) => {
        const { [product.id]: _removed, ...rest } = drafts
        return rest
      })
    }

    setSavingStockId(null)
  }

  // --- Form di creazione/modifica ---------------------------------------
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // true dopo la prima modifica manuale dello slug: da quel momento non lo
  // rigeneriamo più automaticamente digitando il nome, per non sovrascrivere
  // una scelta fatta apposta dall'admin.
  const [slugEditedManually, setSlugEditedManually] = useState(false)
  // Lo SKU è generato dal database (trigger set_product_sku_trigger, vedi
  // schema_products_sku.sql) e di default è in sola lettura: diventa
  // modificabile solo dopo il click su "Modifica manualmente", e solo in
  // quel caso viene incluso nel payload di salvataggio.
  const [skuEditing, setSkuEditing] = useState(false)
  // Conferma mostrata sopra la lista dopo aver creato un prodotto nuovo,
  // con lo SKU appena assegnato dal database: { name, sku }.
  const [createdNotice, setCreatedNotice] = useState(null)
  // Elenco delle foto del prodotto, nell'ordine mostrato nell'editor (la
  // prima è la "principale"). Ogni voce è:
  //   { key, file, previewUrl }
  // "file" è presente solo per le foto appena scelte dall'admin (non
  // ancora caricate): "previewUrl" in quel caso è un object URL locale,
  // altrimenti è l'URL pubblico già salvato su Storage.
  const [images, setImages] = useState([])
  // URL delle foto collegate al prodotto PRIMA di aprire il form: serve
  // solo per capire, al salvataggio, quali file non servono più e vanno
  // ripuliti dallo Storage (vedi handleSubmit).
  const [originalImageUrls, setOriginalImageUrls] = useState([])
  // true mentre carichiamo le foto esistenti di un prodotto in modifica:
  // l'editor delle immagini resta disabilitato in questa finestra, per
  // evitare che un'aggiunta/rimozione fatta troppo in fretta venga persa
  // quando arriva la risposta di Supabase.
  const [loadingFormImages, setLoadingFormImages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formErrorKey, setFormErrorKey] = useState(null)

  // Contatore per generare chiavi React uniche per le foto appena
  // aggiunte (non hanno ancora un id di riga in "product_images").
  const nextImageKeyRef = useRef(0)
  function makeImageKey() {
    nextImageKeyRef.current += 1
    return `new-${nextImageKeyRef.current}`
  }

  function openNewForm() {
    // DIAGNOSTICA TEMPORANEA: questo bottone non fa nessuna chiamata di
    // rete (solo stato locale) — se questo log non compare in console
    // quando clicchi "Nuovo prodotto", il problema non è Supabase/RLS ma
    // il click che non arriva affatto a questo handler (es. bundle non
    // aggiornato nel browser: prova un refresh forzato/incognito, o un
    // elemento che lo copre visivamente: controlla con l'ispettore che
    // l'elemento cliccato sia davvero il <button>).
    console.log('[Admin] Click su "Nuovo prodotto"')
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setSlugEditedManually(false)
    setSkuEditing(false)
    setCreatedNotice(null)
    setImages([])
    setOriginalImageUrls([])
    setLoadingFormImages(false)
    setFormErrorKey(null)
    setShowForm(true)
    // Ricarica le categorie ogni volta che si apre il form, così la select
    // riflette eventuali aggiunte/modifiche fatte da /admin/categorie da
    // quando la pagina è stata caricata.
    void fetchCategories()
  }

  async function openEditForm(product) {
    // DIAGNOSTICA TEMPORANEA: vedi commento in openNewForm.
    console.log('[Admin] Click su "Modifica" per il prodotto:', product.id, product.name)
    setEditingProduct(product)
    setForm({
      name: product.name ?? '',
      slug: product.slug ?? '',
      description: product.description ?? '',
      price: String(product.price ?? ''),
      stock: String(product.stock ?? ''),
      // "" se il prodotto non ha ancora una categoria (es. un prodotto già
      // esistente creato prima di questa funzionalità): la select del form
      // resta senza scelta finché l'admin non ne seleziona una.
      categoryId: product.category_id ?? '',
      sku: product.sku ?? '',
      photoMatchType: product.photo_match_type === 'exact' ? 'exact' : 'similar',
    })
    setSkuEditing(false)
    setCreatedNotice(null)
    // In modifica consideriamo lo slug già "manuale": ritoccare il nome per
    // correggere un refuso non deve cambiare di nascosto l'URL del prodotto
    // (che potrebbe già essere stato condiviso).
    setSlugEditedManually(true)
    setFormErrorKey(null)
    setImages([])
    setOriginalImageUrls([])
    setShowForm(true)
    setLoadingFormImages(true)
    // Vedi commento in openNewForm.
    void fetchCategories()

    // Carichiamo le foto già presenti nella galleria di questo prodotto.
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', product.id)
      .order('display_order')

    if (error) {
      logSupabaseError('Errore nel caricare le foto del prodotto', error)
    }

    const rows = data ?? []

    if (rows.length > 0) {
      setImages(rows.map((row) => ({ key: row.id, file: null, previewUrl: row.image_url })))
      setOriginalImageUrls(rows.map((row) => row.image_url))
    } else if (product.image_url) {
      // Prodotto "storico": nessuna riga in product_images, solo il campo
      // image_url. La mostriamo comunque come un'unica foto nell'editor,
      // gestibile come tutte le altre (rimuovibile, o affiancabile ad
      // altre foto aggiunte adesso).
      setImages([{ key: 'legacy-main', file: null, previewUrl: product.image_url }])
      setOriginalImageUrls([product.image_url])
    }

    setLoadingFormImages(false)
  }

  function closeForm() {
    setShowForm(false)
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    // Le foto appena scelte (non ancora caricate) hanno un object URL
    // locale: lo rilasciamo per non lasciare riferimenti inutili in memoria.
    images.forEach((img) => {
      if (img.file) URL.revokeObjectURL(img.previewUrl)
    })
    setImages([])
    setOriginalImageUrls([])
    setFormErrorKey(null)
  }

  function handleNameChange(event) {
    const name = event.target.value
    setForm((current) => ({
      ...current,
      name,
      // Rigeneriamo lo slug dal nome solo se l'admin non lo ha ancora
      // toccato manualmente in questa sessione di modifica.
      slug: slugEditedManually ? current.slug : slugify(name),
    }))
  }

  function handleSlugChange(event) {
    setSlugEditedManually(true)
    setForm((current) => ({ ...current, slug: event.target.value }))
  }

  function handleFieldChange(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  // Aggiunge alla galleria le foto appena scelte con il selettore file
  // (l'attributo "multiple" permette di sceglierne più di una in un colpo
  // solo, ma l'admin può anche ripetere l'operazione più volte: ogni volta
  // le nuove foto si aggiungono in fondo all'elenco esistente).
  function handleAddImages(event) {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) {
      setImages((current) => [
        ...current,
        ...files.map((file) => ({ key: makeImageKey(), file, previewUrl: URL.createObjectURL(file) })),
      ])
    }
    // Azzeriamo il valore dell'input: senza questo, scegliere di nuovo lo
    // stesso file non riattiverebbe l'evento "change".
    event.target.value = ''
  }

  function handleRemoveImage(key) {
    setImages((current) => {
      const target = current.find((img) => img.key === key)
      if (target?.file) URL.revokeObjectURL(target.previewUrl)
      return current.filter((img) => img.key !== key)
    })
  }

  // Sposta una foto di una posizione avanti (direction: 1) o indietro
  // (direction: -1) nell'elenco: è così che l'admin riordina la galleria
  // e sceglie quale foto diventa la "principale" (la prima).
  function handleMoveImage(key, direction) {
    setImages((current) => {
      const index = current.findIndex((img) => img.key === key)
      const targetIndex = index + direction
      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) return current

      const next = [...current]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    // DIAGNOSTICA TEMPORANEA: vedi commento in openNewForm. Se questo log
    // non compare cliccando "Salva" nel form, il submit del form non sta
    // nemmeno partendo (bottone fuori dal <form>? Bundle non aggiornato?).
    console.log('[Admin] Submit del form prodotto', editingProduct ? `(modifica ${editingProduct.id})` : '(nuovo)')

    const priceNumber = Number(form.price)
    const stockNumber = Number(form.stock)

    if (
      !form.name.trim() ||
      !form.slug.trim() ||
      !form.categoryId ||
      form.price === '' ||
      Number.isNaN(priceNumber) ||
      priceNumber < 0 ||
      form.stock === '' ||
      Number.isNaN(stockNumber) ||
      stockNumber < 0
    ) {
      setFormErrorKey('admin.form.requiredFields')
      return
    }

    setSaving(true)
    setFormErrorKey(null)

    // 1. Carichiamo (ridimensionando lato client, vedi imageResize.js) le
    //    foto appena scelte, mantenendo l'ordine deciso nell'editor. Le
    //    foto già esistenti (senza "file") restano semplicemente il loro
    //    URL già salvato.
    let uploadedImages
    try {
      uploadedImages = await Promise.all(
        images.map(async (img, index) => {
          if (!img.file) {
            return { url: img.previewUrl }
          }

          const resizedBlob = await resizeImageForUpload(img.file)
          const filePath = `${form.slug}-${Date.now()}-${index}.jpg`

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, resizedBlob, { contentType: 'image/jpeg' })

          if (uploadError) throw uploadError

          const {
            data: { publicUrl },
          } = supabase.storage.from('product-images').getPublicUrl(filePath)

          return { url: publicUrl }
        })
      )
    } catch (uploadError) {
      console.error(uploadError)
      setFormErrorKey('admin.form.uploadError')
      setSaving(false)
      return
    }

    // "image_url" sul prodotto resta allineato alla prima foto della
    // galleria (o null se non ce n'è nessuna): è il campo che legge il
    // resto del sito (es. ProductCard) quando mostra una sola immagine.
    const mainImageUrl = uploadedImages[0]?.url ?? null

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      price: priceNumber,
      stock: stockNumber,
      image_url: mainImageUrl,
      category_id: form.categoryId,
      photo_match_type: form.photoMatchType,
    }

    // Lo SKU viaggia nel payload SOLO se l'admin l'ha modificato a mano:
    // altrimenti lo lasciamo interamente al trigger del database (che lo
    // genera all'insert). Un campo svuotato diventa null, e il trigger ne
    // rigenera uno automaticamente.
    if (skuEditing) {
      payload.sku = form.sku.trim() || null
    }

    const { data: savedProduct, error } = editingProduct
      ? await supabase.from('products').update(payload).eq('id', editingProduct.id).select().single()
      : await supabase.from('products').insert(payload).select().single()

    if (error) {
      logSupabaseError(editingProduct ? 'Errore nel modificare il prodotto' : 'Errore nel creare il prodotto', error)
      // Codice Postgres per violazione di un vincolo "unique": può essere
      // lo slug o lo SKU (entrambi "unique" nello schema). Il nome del
      // vincolo nel messaggio d'errore ("products_sku_key", vedi
      // schema_products_sku.sql) distingue i due casi, ognuno con il suo
      // messaggio dedicato invece del generico "errore di salvataggio".
      if (error.code === '23505') {
        setFormErrorKey(error.message?.includes('products_sku_key') ? 'admin.form.skuInUse' : 'admin.form.slugInUse')
      } else {
        setFormErrorKey('admin.form.saveError')
      }
      setSaving(false)
      return
    }

    // 2. Sincronizza "product_images" con l'elenco finale di foto. Con
    //    poche foto per prodotto, sostituire tutte le righe esistenti con
    //    quelle nuove è più semplice e robusto di calcolare un diff fine
    //    (cosa è stata aggiunta/spostata/rimossa), e non lascia ambiguità
    //    sull'ordine.
    //    ECCEZIONE: se alla fine resta al massimo UNA foto, non serve
    //    nessuna riga in product_images — "image_url" sul prodotto la
    //    rappresenta già da sola (stesso stato di un prodotto "storico"
    //    con una sola foto, per piena retrocompatibilità).
    await supabase.from('product_images').delete().eq('product_id', savedProduct.id)

    if (uploadedImages.length > 1) {
      const rows = uploadedImages.map((img, index) => ({
        product_id: savedProduct.id,
        image_url: img.url,
        display_order: index,
      }))

      const { error: imagesError } = await supabase.from('product_images').insert(rows)
      if (imagesError) {
        console.error(imagesError)
      }
    }

    // 3. Ripulisce dallo Storage le foto non più usate da questo prodotto
    //    (rimosse nell'editor, o sostituite). Best-effort: se fallisce non
    //    blocchiamo il salvataggio, già andato a buon fine.
    const finalUrls = uploadedImages.map((img) => img.url)
    const removedUrls = originalImageUrls.filter((url) => !finalUrls.includes(url))
    const removedPaths = removedUrls.map(getStoragePathFromPublicUrl).filter(Boolean)

    if (removedPaths.length > 0) {
      const { error: removeError } = await supabase.storage.from('product-images').remove(removedPaths)
      if (removeError) {
        console.error(removeError)
      }
    }

    setSaving(false)
    // Per un prodotto NUOVO lo SKU esiste solo da adesso (generato dal
    // trigger all'insert): lo mostriamo nella conferma, letto dalla riga
    // restituita da ".select()" dopo l'insert.
    if (!editingProduct) {
      setCreatedNotice({ name: savedProduct.name, sku: savedProduct.sku })
    }
    closeForm()
    fetchProducts()
  }

  function handlePrintLabel(product) {
    const opened = printProductLabel({ sku: product.sku, name: product.name })
    if (!opened) {
      window.alert(t('admin.labelPopupBlocked'))
    }
  }

  // --- Eliminazione prodotto ---------------------------------------------
  async function handleDelete(product) {
    // DIAGNOSTICA TEMPORANEA: vedi commento in openNewForm. Compare anche
    // se poi si annulla il window.confirm() qui sotto: distingue "il click
    // non arriva al bottone" da "arriva, ma l'utente/il conferma annulla".
    console.log('[Admin] Click su "Elimina" per il prodotto:', product.id, product.name)

    const confirmed = window.confirm(t('admin.confirmDelete', { name: product.name }))
    if (!confirmed) return

    // Recuperiamo prima le eventuali foto aggiuntive della galleria: le
    // relative righe in "product_images" vengono eliminate automaticamente
    // dal database (foreign key "on delete cascade"), ma i file su Storage
    // no, quindi ci serve il loro URL PRIMA di cancellare il prodotto.
    const { data: extraImages } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_id', product.id)

    // La DELETE va sempre a buon fine anche se il prodotto ha ordini
    // collegati: il trigger "snapshot_product_name_before_delete_trigger"
    // (vedi schema_order_items_snapshot.sql) salva il nome del prodotto in
    // ogni order_items collegato un istante prima che la riga sparisca, e
    // la foreign key è "on delete set null" invece di bloccare l'operazione
    // — lo storico ordini resta leggibile (nome + price_at_purchase, già
    // salvato a sé), anche se il prodotto in sé non esiste più.
    const { error } = await supabase.from('products').delete().eq('id', product.id)

    if (error) {
      logSupabaseError(`Errore nell'eliminare il prodotto ${product.id}`, error)
      window.alert(t('admin.deleteError'))
      return
    }

    // Proviamo a eliminare anche i file delle immagini dal bucket, per non
    // lasciare foto "orfane" nello Storage. Se fallisce (es. immagine già
    // rimossa, o permessi) non blocchiamo comunque l'eliminazione del
    // prodotto, già andata a buon fine: registriamo solo l'errore.
    const allImageUrls = [product.image_url, ...(extraImages ?? []).map((row) => row.image_url)]
    // "new Set" toglie i duplicati: la foto principale spesso coincide con
    // la prima riga di product_images.
    const storagePaths = [...new Set(allImageUrls.map(getStoragePathFromPublicUrl).filter(Boolean))]

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('product-images')
        .remove(storagePaths)
      if (storageError) {
        console.error(storageError)
      }
    }

    setProducts((current) => current.filter((item) => item.id !== product.id))
  }

  // Disattiva un prodotto SENZA eliminarlo: sparisce dal negozio pubblico
  // (Shop.jsx/Home.jsx/ProductDetail.jsx filtrano active=true) ma resta nel
  // database con tutti i suoi dati (descrizione, immagini, categoria),
  // riattivabile in qualsiasi momento — a differenza di "Elimina", che ora
  // cancella per sempre la riga del prodotto (vedi handleDelete): utile per
  // un prodotto solo temporaneamente non in vendita (es. fuori produzione
  // ma potrebbe tornare), invece che per liberarsene definitivamente.
  async function handleDeactivate(product) {
    const confirmed = window.confirm(t('admin.confirmDeactivate', { name: product.name }))
    if (!confirmed) return

    const { error } = await supabase.from('products').update({ active: false }).eq('id', product.id)

    if (error) {
      logSupabaseError(`Errore nel disattivare il prodotto ${product.id}`, error)
      window.alert(t('admin.deactivateError'))
      return
    }

    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, active: false } : item))
    )
  }

  // Riporta "active" a true un prodotto disattivato in precedenza: torna a
  // comparire nel negozio pubblico.
  async function handleReactivate(product) {
    const { error } = await supabase.from('products').update({ active: true }).eq('id', product.id)

    if (error) {
      logSupabaseError(`Errore nel riattivare il prodotto ${product.id}`, error)
      window.alert(t('admin.reactivateError'))
      return
    }

    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, active: true } : item))
    )
  }

  return (
    <div className="admin-page">
      <AdminNav />

      <div className="admin-header">
        <h1 className="admin-title">{t('admin.title')}</h1>
        <button type="button" className="btn-primary" onClick={openNewForm}>
          {t('admin.newProduct')}
        </button>
      </div>

      {/* --- Conferma dopo la creazione di un prodotto nuovo, con lo SKU
          appena generato dal database --- */}
      {createdNotice && (
        <div className="admin-created-notice" role="status">
          <p className="admin-created-notice-text">
            {t('admin.createdNotice', { name: createdNotice.name })}{' '}
            <span className="admin-sku">{createdNotice.sku ?? '—'}</span>
          </p>
          <div className="admin-created-notice-actions">
            {createdNotice.sku && (
              <button type="button" className="btn-secondary btn-sm" onClick={() => handlePrintLabel(createdNotice)}>
                {t('admin.table.printLabel')}
              </button>
            )}
            <button type="button" className="btn-secondary btn-sm" onClick={() => setCreatedNotice(null)}>
              {t('admin.createdNoticeDismiss')}
            </button>
          </div>
        </div>
      )}

      {/* --- Form di creazione/modifica, mostrato solo quando serve --- */}
      {showForm && (
        <div className="admin-form-panel">
          <h2>{editingProduct ? t('admin.form.editTitle') : t('admin.form.newTitle')}</h2>

          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-name">
                {t('admin.form.name')}
              </label>
              <input
                id="admin-name"
                className="auth-input"
                value={form.name}
                onChange={handleNameChange}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-slug">
                {t('admin.form.slug')}
              </label>
              <input
                id="admin-slug"
                className="auth-input"
                value={form.slug}
                onChange={handleSlugChange}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-sku">
                {t('admin.form.sku')}
              </label>
              <div className="admin-sku-editor">
                <input
                  id="admin-sku"
                  className="auth-input admin-sku-input"
                  value={form.sku}
                  onChange={handleFieldChange('sku')}
                  readOnly={!skuEditing}
                  placeholder={editingProduct ? '' : t('admin.form.skuAutoPlaceholder')}
                />
                {!skuEditing && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setSkuEditing(true)}>
                    {t('admin.form.skuEditManually')}
                  </button>
                )}
              </div>
              <p className="admin-form-hint">
                {skuEditing ? t('admin.form.skuManualHint') : t('admin.form.skuHint')}
              </p>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-category">
                {t('admin.form.category')}
              </label>
              <select
                id="admin-category"
                className="auth-input"
                value={form.categoryId}
                onChange={handleFieldChange('categoryId')}
                required
              >
                <option value="" disabled>
                  {t('admin.form.categoryPlaceholder')}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {t(`categories.${category.slug}`, {
                      defaultValue: getCategoryFallbackName(category, i18n.language),
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Radio visibili (non una select): le due opzioni hanno
                conseguenze diverse per il cliente, e il testo d'aiuto di
                ognuna deve essere leggibile PRIMA di scegliere. */}
            <fieldset className="admin-photo-match">
              <legend className="auth-label">{t('admin.form.photoMatch')}</legend>
              {PHOTO_MATCH_OPTIONS.map((option) => (
                <label
                  key={option}
                  className={
                    form.photoMatchType === option
                      ? 'admin-photo-match-option admin-photo-match-option-selected'
                      : 'admin-photo-match-option'
                  }
                >
                  <input
                    type="radio"
                    name="admin-photo-match"
                    value={option}
                    checked={form.photoMatchType === option}
                    onChange={handleFieldChange('photoMatchType')}
                  />
                  <span className="admin-photo-match-text">
                    <span className="admin-photo-match-title">{t(`admin.form.photoMatchOptions.${option}.label`)}</span>
                    <span className="admin-form-hint">{t(`admin.form.photoMatchOptions.${option}.help`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-description">
                {t('admin.form.description')}
              </label>
              <textarea
                id="admin-description"
                className="auth-input admin-textarea"
                rows={4}
                value={form.description}
                onChange={handleFieldChange('description')}
              />
            </div>

            <div className="admin-form-row">
              <div className="auth-field">
                <label className="auth-label" htmlFor="admin-price">
                  {t('admin.form.price')}
                </label>
                <input
                  id="admin-price"
                  className="auth-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleFieldChange('price')}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="admin-stock">
                  {t('admin.form.stock')}
                </label>
                <input
                  id="admin-stock"
                  className="auth-input"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={handleFieldChange('stock')}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-images">
                {t('admin.form.images')}
              </label>
              <input
                id="admin-images"
                type="file"
                accept="image/*"
                multiple
                disabled={loadingFormImages}
                onChange={handleAddImages}
              />
              <p className="admin-form-hint">{t('admin.form.imagesHint')}</p>

              {loadingFormImages && (
                <p className="admin-form-hint">{t('admin.form.imagesLoading')}</p>
              )}

              {images.length > 0 && (
                <ul className="admin-image-list">
                  {images.map((img, index) => (
                    <li className="admin-image-item" key={img.key}>
                      <img className="admin-image-item-preview" src={img.previewUrl} alt="" />
                      <div className="admin-image-item-actions">
                        <span className="admin-image-item-index">
                          {index === 0 ? t('admin.form.imageMain') : `#${index + 1}`}
                        </span>
                        <div className="admin-image-item-buttons">
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => handleMoveImage(img.key, -1)}
                            disabled={loadingFormImages || index === 0}
                            aria-label={t('admin.form.imageMoveUp')}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => handleMoveImage(img.key, 1)}
                            disabled={loadingFormImages || index === images.length - 1}
                            aria-label={t('admin.form.imageMoveDown')}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            onClick={() => handleRemoveImage(img.key)}
                            disabled={loadingFormImages}
                          >
                            {t('admin.form.imageRemove')}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {formErrorKey && <p className="auth-error">{t(formErrorKey)}</p>}

            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={saving || loadingFormImages}>
                {saving ? t('admin.form.saving') : t('admin.form.save')}
              </button>
              <button type="button" className="btn-secondary" onClick={closeForm}>
                {t('admin.form.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- Lista prodotti --- */}
      {loadingProducts && <p className="admin-message">{t('admin.loading')}</p>}
      {!loadingProducts && listErrorKey && <p className="admin-message">{t(listErrorKey)}</p>}
      {!loadingProducts && !listErrorKey && products.length === 0 && (
        <p className="admin-message">{t('admin.empty')}</p>
      )}

      {!loadingProducts && !listErrorKey && products.length > 0 && (
        <div className="admin-table-wrapper">
          {/* Tabella costruita con CSS Grid (vedi Admin.css) invece di un
              <table> HTML: ogni "riga" qui sotto ha display:contents, così
              le sue celle diventano celle dirette della stessa griglia
              condivisa da tutte le righe — è la griglia (align-items:
              center sulle colonne) a garantire l'allineamento verticale,
              non margini/padding calcolati riga per riga. I ruoli ARIA
              (table/row/columnheader/cell) mantengono la semantica di
              tabella per chi usa uno screen reader. */}
          <div className="admin-table" role="table">
            <div className="admin-table-row" role="row">
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('admin.table.image')}
              </span>
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('admin.table.sku')}
              </span>
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('admin.table.name')}
              </span>
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('admin.table.price')}
              </span>
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('admin.table.stock')}
              </span>
              <span className="admin-table-cell admin-table-head-cell" role="columnheader">
                {t('admin.table.actions')}
              </span>
            </div>

            {products.map((product) => {
              const formattedPrice = new Intl.NumberFormat('it-IT', {
                style: 'currency',
                currency: 'EUR',
              }).format(product.price)
              const stockDraft = stockDrafts[product.id]
              const isInactive = product.active === false

              return (
                <div
                  className={isInactive ? 'admin-table-row admin-table-row-inactive' : 'admin-table-row'}
                  role="row"
                  key={product.id}
                >
                  <div className="admin-table-cell" role="cell">
                    {product.image_url ? (
                      <img className="admin-table-thumb" src={product.image_url} alt={product.name} />
                    ) : (
                      <span className="admin-table-thumb admin-table-thumb-empty" aria-hidden="true">
                        —
                      </span>
                    )}
                  </div>
                  <div className="admin-table-cell" role="cell">
                    <span className="admin-sku">{product.sku ?? '—'}</span>
                  </div>
                  <div className="admin-table-cell" role="cell">
                    {product.name}
                    {isInactive && <span className="admin-badge-inactive">{t('admin.table.inactive')}</span>}
                  </div>
                  <div className="admin-table-cell" role="cell">
                    {formattedPrice}
                  </div>
                  <div className="admin-table-cell admin-table-cell-stock" role="cell">
                    <div className="admin-stock-editor">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="admin-stock-input"
                        value={stockDraft ?? product.stock}
                        onChange={(event) => handleStockDraftChange(product.id, event.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        disabled={savingStockId === product.id || stockDraft === undefined}
                        onClick={() => handleSaveStock(product)}
                      >
                        {t('admin.table.saveStock')}
                      </button>
                    </div>
                    {stockErrorId === product.id && (
                      <p className="admin-stock-error">{t('admin.stockUpdateError')}</p>
                    )}
                  </div>
                  <div className="admin-table-cell admin-table-cell-actions" role="cell">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => openEditForm(product)}>
                      {t('admin.table.edit')}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => handlePrintLabel(product)}
                      disabled={!product.sku}
                    >
                      {t('admin.table.printLabel')}
                    </button>
                    {isInactive ? (
                      <button type="button" className="btn-secondary btn-sm" onClick={() => handleReactivate(product)}>
                        {t('admin.table.reactivate')}
                      </button>
                    ) : (
                      <button type="button" className="btn-secondary btn-sm" onClick={() => handleDeactivate(product)}>
                        {t('admin.table.deactivate')}
                      </button>
                    )}
                    <button type="button" className="btn-danger btn-sm" onClick={() => handleDelete(product)}>
                      {t('admin.table.delete')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
