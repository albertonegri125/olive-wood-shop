// src/components/AdminNav.jsx
//
// Navigazione tra le sezioni del pannello admin (oggi due: catalogo
// prodotti su /admin, gestione amministratori su /admin/utenti). Estratta
// in un componente a parte perché usata identica sia in Admin.jsx sia in
// AdminUsers.jsx, invece di duplicare lo stesso markup in entrambe le
// pagine.

import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './AdminNav.css'

function AdminNav() {
  const { t } = useTranslation()

  return (
    <nav className="admin-nav" aria-label={t('admin.nav.label')}>
      <NavLink
        to="/admin"
        end
        className={({ isActive }) => `admin-nav-link${isActive ? ' admin-nav-link-active' : ''}`}
      >
        {t('admin.nav.products')}
      </NavLink>
      <NavLink
        to="/admin/utenti"
        className={({ isActive }) => `admin-nav-link${isActive ? ' admin-nav-link-active' : ''}`}
      >
        {t('admin.nav.users')}
      </NavLink>
    </nav>
  )
}

export default AdminNav
