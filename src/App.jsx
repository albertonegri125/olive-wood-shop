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
import RequireAdmin from './components/RequireAdmin'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import CheckoutSuccess from './pages/CheckoutSuccess'
import CheckoutCancel from './pages/CheckoutCancel'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import Admin from './pages/Admin'
import About from './pages/About'
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

            {/* Checkout: riepilogo ordine + bottone di pagamento, che
                reindirizza a Stripe Checkout. Protetta: bisogna essere
                loggati. */}
            <Route
              path="/checkout"
              element={
                <RequireAuth>
                  <Checkout />
                </RequireAuth>
              }
            />

            {/* Pagine di arrivo dopo il pagamento su Stripe (vedi
                success_url/cancel_url in create-checkout-session). Solo
                "success" è protetta: ha senso solo per chi ha appena
                effettuato un acquisto da loggato; "cancel" resta pubblica,
                non mostra nessun dato sensibile. */}
            <Route
              path="/checkout/success"
              element={
                <RequireAuth>
                  <CheckoutSuccess />
                </RequireAuth>
              }
            />
            <Route path="/checkout/cancel" element={<CheckoutCancel />} />

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

            {/* Pannello admin: gestione prodotti (catalogo, scorte, foto).
                Protetta: se non loggati o senza is_admin=true nel profilo,
                si viene rimandati direttamente alla Home. */}
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <Admin />
                </RequireAdmin>
              }
            />

            {/* Pagina "Chi siamo": due percorsi equivalenti verso la stessa
                pagina, così funzionano sia link in italiano sia in inglese. */}
            <Route path="/chi-siamo" element={<About />} />
            <Route path="/about" element={<About />} />

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
