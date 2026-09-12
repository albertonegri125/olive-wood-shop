// src/components/Navbar.jsx
//
// Barra di navigazione principale del sito, sempre visibile in alto.
// - Su desktop mostra il logo (con badge "Made in Italy" accanto) a sinistra,
//   i link in orizzontale a destra e il selettore di lingua.
// - Su mobile i link si nascondono dietro un menu "hamburger" (☰): aprendolo
//   si apre un overlay a tutto schermo con i link, per una navigazione
//   comoda anche su schermi piccoli.

import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../context/CartContext'
import LanguageSwitcher from './LanguageSwitcher'
import './Navbar.css'

function Navbar() {
  const { t } = useTranslation()

  // Numero di articoli nel carrello: somma delle quantità di ogni riga
  // (es. 2 taglieri + 1 vassoio = 3), preso in tempo reale dal CartContext.
  const { cart } = useCart()
  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0)

  // Stato che controlla se il menu mobile (hamburger) è aperto o chiuso.
  const [menuOpen, setMenuOpen] = useState(false)

  // Hook che ci dice qual è la pagina attuale (cambia ad ogni navigazione).
  const location = useLocation()

  // Ogni volta che l'utente naviga verso una nuova pagina, chiudiamo
  // automaticamente il menu mobile (se era aperto), così non resta aperto
  // "per sbaglio" sopra la nuova pagina.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Funzione di comodo per assegnare la classe "active" al link della
  // pagina corrente, così possiamo evidenziarlo visivamente nel CSS.
  const linkClassName = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Blocco logo: piccolo badge "Made in Italy" accanto al nome del
            negozio, per comunicare fin da subito l'artigianalità italiana. */}
        <div className="navbar-brand">
          <NavLink to="/" className="navbar-logo logo">
            Olive&nbsp;Wood&nbsp;Shop
          </NavLink>
          <span className="eyebrow eyebrow-tag navbar-badge">{t('navbar.badge')}</span>
        </div>

        {/* Bottone hamburger: visibile solo su mobile (nascosto via CSS su desktop).
            Il pulsante è un <button> vero per accessibilità (funziona con tastiera/screen reader).
            Quando il menu è aperto, la classe "open" trasforma le tre barrette in una "X". */}
        <button
          type="button"
          className={menuOpen ? 'navbar-toggle open' : 'navbar-toggle'}
          aria-label={menuOpen ? t('navbar.closeMenu') : t('navbar.openMenu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {/* Le tre "barrette" dell'icona hamburger, disegnate con dei semplici <span> */}
          <span className="navbar-toggle-bar" />
          <span className="navbar-toggle-bar" />
          <span className="navbar-toggle-bar" />
        </button>

        {/* Elenco dei link di navigazione.
            La classe "open" viene aggiunta quando il menu mobile è aperto:
            su mobile fa comparire l'overlay a tutto schermo con i link,
            su desktop non ha alcun effetto (i link sono sempre visibili in riga). */}
        <nav className={menuOpen ? 'navbar-links open' : 'navbar-links'}>
          <NavLink to="/" className={linkClassName} end>
            {t('navbar.home')}
          </NavLink>
          <NavLink to="/shop" className={linkClassName}>
            {t('navbar.shop')}
          </NavLink>
          <NavLink to="/account" className={linkClassName}>
            {t('navbar.account')}
          </NavLink>
          <NavLink to="/cart" className={linkClassName}>
            {t('navbar.cart')}
            {/* Il numero di articoli viene mostrato solo se maggiore di 0,
                per non riempire la navbar con un "0" inutile */}
            {cartItemsCount > 0 && (
              <span className="navbar-cart-count">{cartItemsCount}</span>
            )}
          </NavLink>

          {/* Selettore di lingua: cambia la lingua di tutta l'app all'istante,
              senza ricaricare la pagina. */}
          <LanguageSwitcher className="navbar-language" />
        </nav>
      </div>
    </header>
  )
}

export default Navbar
