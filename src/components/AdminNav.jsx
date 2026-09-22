// src/components/AdminNav.jsx
//
// Navigazione tra le sezioni del pannello admin (catalogo prodotti su
// /admin, categorie su /admin/categorie, gestione amministratori su
// /admin/utenti). Estratta in un componente a parte perché usata identica
// in tutte le pagine admin, invece di duplicare lo stesso markup in ognuna.

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
        to="/admin/categorie"
        className={({ isActive }) => `admin-nav-link${isActive ? ' admin-nav-link-active' : ''}`}
      >
        {t('admin.nav.categories')}
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
