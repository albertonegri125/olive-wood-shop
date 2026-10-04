// src/components/AdminNav.jsx
//
// Navigazione tra le sezioni del pannello admin (panoramica su /admin,
// catalogo prodotti su /admin/prodotti, categorie su /admin/categorie,
// ordini su /admin/ordini, clienti su /admin/clienti, recensioni su
// /admin/recensioni, gestione amministratori su /admin/utenti). Estratta
// in un componente a parte perché usata identica in tutte le pagine
// admin, invece di duplicare lo stesso markup in ognuna.

import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './AdminNav.css'

// "end" solo sulla Panoramica: senza, "/admin" risulterebbe attivo anche
// su tutte le altre sezioni (che iniziano tutte con "/admin/").
const SECTIONS = [
  { to: '/admin', labelKey: 'admin.nav.overview', end: true },
  { to: '/admin/prodotti', labelKey: 'admin.nav.products' },
  { to: '/admin/categorie', labelKey: 'admin.nav.categories' },
  { to: '/admin/ordini', labelKey: 'admin.nav.orders' },
  { to: '/admin/clienti', labelKey: 'admin.nav.customers' },
  { to: '/admin/recensioni', labelKey: 'admin.nav.reviews' },
  { to: '/admin/utenti', labelKey: 'admin.nav.users' },
]

function AdminNav() {
  const { t } = useTranslation()

  return (
    <nav className="admin-nav" aria-label={t('admin.nav.label')}>
      {SECTIONS.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          end={section.end}
          className={({ isActive }) => `admin-nav-link${isActive ? ' admin-nav-link-active' : ''}`}
        >
          {t(section.labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}

export default AdminNav
