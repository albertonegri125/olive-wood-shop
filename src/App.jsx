// src/App.jsx
//
// Componente radice dell'app: definisce la struttura generale della pagina
// (Navbar sempre visibile in alto) e le rotte (route) gestite da react-router,
// cioè quale pagina mostrare in base all'URL corrente.

import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import CookieBanner from './components/CookieBanner'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TerminiCondizioni from './pages/TerminiCondizioni'
import DirittoRecesso from './pages/DirittoRecesso'
import CookiePolicy from './pages/CookiePolicy'
import './App.css'

function App() {
  return (
    // AuthProvider e CartProvider avvolgono tutta l'app: così Navbar,
    // ProductCard, ProductDetail e le pagine Cart/Account/Checkout possono
    // tutti leggere/modificare lo stesso utente e lo stesso carrello
    // tramite gli hook useAuth()/useCart(), senza doverseli passare
    // manualmente come prop da un componente all'altro.
    <AuthProvider>
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

            {/* Checkout: riepilogo ordine + bottone di pagamento (per ora
                solo un placeholder). Protetta: bisogna essere loggati. */}
            <Route
              path="/checkout"
              element={
                <RequireAuth>
                  <Checkout />
                </RequireAuth>
              }
            />

            {/* Accesso e registrazione */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Account personale: dati profilo + storico ordini. Protetta:
                se non loggati si viene rimandati a /login. */}
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <Account />
                </RequireAuth>
              }
            />

            {/* Pagine legali obbligatorie per un e-commerce europeo */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/termini" element={<TerminiCondizioni />} />
            <Route path="/recesso" element={<DirittoRecesso />} />
            <Route path="/cookie" element={<CookiePolicy />} />
          </Routes>
        </main>

        {/* Footer sempre visibile in fondo, su tutte le pagine */}
        <Footer />

        {/* Banner cookie: compare finché l'utente non clicca "Accetta" */}
        <CookieBanner />
      </CartProvider>
    </AuthProvider>
  )
}

export default App
