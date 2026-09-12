// src/components/AccountMenu.jsx
//
// Voce "Account" della Navbar, con due comportamenti diversi:
// - Utente NON loggato: un normale link verso /login.
// - Utente loggato: il suo nome/email, che apre un piccolo menu a tendina
//   con i link "Account" e "Esci".
//
// Componente a parte (invece di infilare tutta questa logica dentro
// Navbar.jsx) per tenere la Navbar più leggibile.

import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

function AccountMenu() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  // Riferimento al contenitore del menu: ci serve per capire se un click
  // è avvenuto "fuori" dal menu, per poterlo chiudere automaticamente.
  const menuRef = useRef(null)

  const linkClassName = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')

  // Chiude il menu se l'utente clicca da qualche altra parte della pagina.
  useEffect(() => {
    if (!menuOpen) return undefined

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  // Chiude il menu ad ogni cambio di pagina (stesso comportamento
  // dell'overlay mobile della Navbar).
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Utente non loggato: semplice link alla pagina di accesso.
  if (!user) {
    return (
      <NavLink to="/login" className={linkClassName}>
        {t('navbar.account')}
      </NavLink>
    )
  }

  // Nome mostrato nella Navbar: quello scelto in registrazione, oppure
  // l'email come ripiego (sempre disponibile per un utente loggato).
  const displayName = user.user_metadata?.full_name || user.email

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="nav-link account-menu-trigger"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
      >
        {displayName}
      </button>

      {menuOpen && (
        <div className="account-menu-dropdown">
          <NavLink to="/account" className="account-menu-item">
            {t('navbar.account')}
          </NavLink>
          <button type="button" className="account-menu-item account-menu-signout" onClick={handleSignOut}>
            {t('navbar.logout')}
          </button>
        </div>
      )}
    </div>
  )
}

export default AccountMenu
