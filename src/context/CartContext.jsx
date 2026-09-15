// src/context/CartContext.jsx
//
// Context React che gestisce lo stato del carrello per tutta l'app.
// Usa useReducer (invece di più useState separati) perché le operazioni sul
// carrello sono tutte "variazioni di una stessa lista" (aggiungi, rimuovi,
// cambia quantità, svuota): un reducer le raccoglie in un unico posto,
// rendendo più facile capire e testare come cambia lo stato.
//
// Il carrello viene salvato in localStorage ad ogni modifica, così
// sopravvive a un refresh della pagina (o alla chiusura del browser).

import { createContext, useContext, useEffect, useReducer } from 'react'

// Chiave usata per salvare/leggere il carrello in localStorage.
const CART_STORAGE_KEY = 'cart'

// Il Context vero e proprio: inizialmente vuoto, verrà "riempito" dal
// CartProvider qui sotto con lo stato reale e le funzioni per modificarlo.
const CartContext = createContext(null)

// --- Lettura iniziale da localStorage -------------------------------------
//
// Questa funzione viene passata come "initializer" a useReducer: viene
// eseguita una sola volta, al primo render, per calcolare lo stato di
// partenza del carrello leggendo quanto salvato in precedenza.
// È avvolta in un try/catch perché localStorage può non essere disponibile
// (es. modalità di navigazione privata) o contenere dati corrotti.
function readCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    // Ci assicuriamo che sia sempre un array: se localStorage contenesse
    // qualcosa di inatteso, ripartiamo da un carrello vuoto invece di rompere l'app.
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// --- Reducer: calcola il nuovo stato del carrello in base all'azione -----
//
// Lo stato del carrello è un array di oggetti con questa forma:
// { product_id, name, price, image_url, quantity, stock_disponibile }
function cartReducer(cartItems, action) {
  switch (action.type) {
    // Aggiunge un prodotto al carrello (o ne incrementa la quantità se c'è già).
    case 'ADD_TO_CART': {
      const product = action.payload

      // Non ha senso aggiungere un prodotto esaurito: controllo di sicurezza,
      // anche se l'interfaccia dovrebbe già impedirlo disabilitando il bottone.
      if (!product.stock || product.stock <= 0) {
        return cartItems
      }

      const existingItem = cartItems.find((item) => item.product_id === product.id)

      if (existingItem) {
        // Prodotto già presente: aumentiamo la quantità di 1, ma senza mai
        // superare lo stock disponibile (usiamo il valore più aggiornato
        // arrivato da "product", nel caso lo stock sia cambiato nel frattempo).
        return cartItems.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                stock_disponibile: product.stock,
                quantity: Math.min(item.quantity + 1, product.stock),
              }
            : item
        )
      }

      // Prodotto non ancora nel carrello: lo aggiungiamo con quantità 1,
      // copiando solo i campi che servono per mostrarlo nel carrello
      // (non l'intero oggetto prodotto, per tenere lo stato snello).
      const newItem = {
        product_id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        quantity: 1,
        stock_disponibile: product.stock,
      }
      return [...cartItems, newItem]
    }

    // Rimuove del tutto un prodotto dal carrello (bottone "cestino").
    case 'REMOVE_FROM_CART': {
      const productId = action.payload
      return cartItems.filter((item) => item.product_id !== productId)
    }

    // Imposta una quantità precisa per un prodotto (usato dai bottoni +/-
    // nella pagina Carrello). La quantità viene sempre "vincolata" (clamp)
    // tra 1 (non si scende sotto: per azzerare c'è il bottone rimuovi) e
    // lo stock disponibile per quel prodotto.
    case 'UPDATE_QUANTITY': {
      const { productId, quantity } = action.payload
      return cartItems.map((item) => {
        if (item.product_id !== productId) return item
        const clampedQuantity = Math.min(Math.max(quantity, 1), item.stock_disponibile)
        return { ...item, quantity: clampedQuantity }
      })
    }

    // Svuota completamente il carrello.
    case 'CLEAR_CART':
      return []

    default:
      return cartItems
  }
}

// --- Provider: va messo attorno all'app, così tutte le pagine/componenti
// annidati possono leggere e modificare il carrello tramite useCart(). ---
export function CartProvider({ children }) {
  // useReducer(reducer, argomentoIniziale, funzioneInit): la funzione di
  // init viene chiamata una sola volta per calcolare lo stato di partenza,
  // qui leggendolo da localStorage.
  const [cart, dispatch] = useReducer(cartReducer, undefined, readCartFromStorage)

  // Ogni volta che il carrello cambia, lo risalviamo in localStorage,
  // così resta disponibile anche dopo un refresh della pagina.
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    } catch {
      // Se localStorage non è disponibile il carrello semplicemente non
      // verrà ricordato al refresh: non è un errore bloccante per l'app.
    }
  }, [cart])

  // Aggiunge un prodotto al carrello (o incrementa la quantità se già presente).
  // Riceve il prodotto "così com'è" da Supabase (id, name, price, image_url, stock, ...).
  function addToCart(product) {
    dispatch({ type: 'ADD_TO_CART', payload: product })
  }

  // Rimuove completamente un prodotto dal carrello, dato il suo id.
  function removeFromCart(productId) {
    dispatch({ type: 'REMOVE_FROM_CART', payload: productId })
  }

  // Aggiorna la quantità di un prodotto già nel carrello (usato dai
  // controlli +/- nella pagina Carrello). Non serve controllare qui i
  // limiti (min 1, max stock): ci pensa già il reducer.
  function updateQuantity(productId, quantity) {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, quantity } })
  }

  // Svuota il carrello (utile ad esempio dopo un checkout completato).
  function clearCart() {
    dispatch({ type: 'CLEAR_CART' })
  }

  // Calcola il totale complessivo del carrello (somma di prezzo * quantità
  // per ogni riga). È una funzione (non un valore già calcolato) per
  // restare fedele al nome richiesto e per essere esplicita: va chiamata.
  function getTotal() {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  // --- Sconto "bundle" a scaglioni ------------------------------------
  //
  // Incentiva l'acquisto di PIÙ PRODOTTI DIVERSI nello stesso ordine (non
  // di più pezzi dello stesso prodotto): comprare 3 taglieri uguali non
  // dà diritto allo sconto, comprare 3 prodotti diversi sì.
  //
  //   1 prodotto diverso        -> nessuno sconto
  //   2 prodotti diversi        -> 10%
  //   3 o più prodotti diversi  -> 15% (tetto massimo: non cresce oltre)
  //
  // Il carrello ha già, per costruzione, UNA sola riga per ogni prodotto
  // (vedi ADD_TO_CART nel reducer sopra: se il prodotto è già presente se
  // ne incrementa solo la quantità, non si crea una seconda riga), quindi
  // "numero di prodotti diversi" coincide semplicemente con "cart.length"
  // — non serve calcolare un Set di product_id a parte.
  function getDiscountPercentage() {
    const distinctProductsCount = cart.length

    if (distinctProductsCount >= 3) return 15
    if (distinctProductsCount === 2) return 10
    return 0
  }

  // Applica la percentuale di sconto calcolata sopra al totale pieno.
  //
  // NOTA: questo calcolo vive solo lato client, per mostrare subito il
  // prezzo scontato nell'interfaccia (Cart.jsx, Checkout.jsx). Quando sarà
  // collegato il pagamento reale con Stripe, il totale scontato andrà
  // RICALCOLATO anche lato server/webhook prima di creare la sessione di
  // pagamento: non ci si può fidare di un totale calcolato nel browser per
  // decidere quanto far pagare un cliente (potrebbe essere alterato).
  function getDiscountedTotal() {
    const total = getTotal()
    const discountPercentage = getDiscountPercentage()
    return total - (total * discountPercentage) / 100
  }

  // Il valore esposto a tutti i componenti che useranno useCart().
  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotal,
    getDiscountPercentage,
    getDiscountedTotal,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// Hook di comodo per accedere al carrello, invece di dover importare sia
// useContext che CartContext in ogni componente. Lancia un errore chiaro
// se viene usato fuori da un <CartProvider>, per individuare subito
// eventuali errori di composizione dei componenti.
export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart deve essere usato dentro un <CartProvider>')
  }
  return context
}
