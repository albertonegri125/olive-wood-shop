// src/App.jsx
//
// Componente radice dell'app: definisce la struttura generale della pagina
// (Navbar sempre visibile in alto) e le rotte (route) gestite da react-router,
// cioè quale pagina mostrare in base all'URL corrente.

import { Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import './App.css'

function App() {
  return (
    // CartProvider avvolge tutta l'app: così Navbar, ProductCard,
    // ProductDetail e la pagina Cart possono tutti leggere/modificare lo
    // stesso carrello tramite l'hook useCart(), senza doverselo passare
    // manualmente come prop da un componente all'altro.
    <CartProvider>
      {/* La Navbar viene renderizzata fuori dalle <Routes>, così resta
          sempre visibile sopra qualunque pagina venga mostrata sotto. */}
      <Navbar />

      <main className="app-main">
        <Routes>
          {/* Pagina iniziale */}
          <Route path="/" element={<Home />} />

          {/* Elenco di tutti i prodotti */}
          <Route path="/shop" element={<Shop />} />

          {/* Dettaglio di un singolo prodotto, identificato dallo slug nell'URL */}
          <Route path="/shop/:slug" element={<ProductDetail />} />

          {/* Carrello: mostra gli articoli aggiunti, con quantità e totale */}
          <Route path="/cart" element={<Cart />} />

          {/* Checkout: per ora una pagina segnaposto, la implementeremo
              in uno step successivo (pagamento con Stripe). */}
          <Route path="/checkout" element={<Checkout />} />

          {/* NOTA: la pagina "/account" (già linkata in Navbar) verrà
              implementata in uno step successivo, insieme al login/autenticazione. */}
        </Routes>
      </main>

      {/* Footer sempre visibile in fondo, su tutte le pagine */}
      <Footer />
    </CartProvider>
  )
}

export default App
