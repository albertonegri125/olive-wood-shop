// src/components/icons.jsx
//
// Piccole icone decorative disegnate come SVG inline (nessuna libreria di
// icone esterna, nessun file da scaricare): vengono usate accanto ai trust
// badge e agli step del processo artigianale, sia in Home che in
// ProductDetail. Essendo inline pesano pochissimo e ereditano il colore
// del testo circostante tramite "currentColor".

// Componente di base: definisce gli attributi comuni a tutte le icone
// (dimensione, spessore del tratto, nessun riempimento) così ogni icona
// deve specificare solo i propri "path".
function IconBase({ children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true" // sono puramente decorative: il testo accanto spiega già il significato
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

// Furgone/pacco: usata per "Spedizione assicurata" / "Consegna assicurata"
export function IconShipping(props) {
  return (
    <IconBase {...props}>
      <rect x="1" y="6" width="14" height="10" />
      <path d="M15 9h4l3 3v4h-7z" />
      <circle cx="6" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </IconBase>
  )
}

// Scudo con spunta: usata per "Pagamento sicuro"
export function IconPayment(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
      <path d="M9.5 12l2 2 3-3.5" />
    </IconBase>
  )
}

// Piccola "scintilla": usata per "Pezzi unici fatti a mano"
export function IconUnique(props) {
  return (
    <IconBase {...props}>
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
    </IconBase>
  )
}

// Freccia circolare: usata per "Reso gratuito entro 14 giorni"
export function IconReturn(props) {
  return (
    <IconBase {...props}>
      <path d="M4 4v5h5" />
      <path d="M4.5 13a8 8 0 1 0 2.5-6.5L4 9" />
    </IconBase>
  )
}

// Sezione di un tronco: usata per lo step "Scelta del legno"
export function IconWood(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="9" r="6" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M12 15v6" />
    </IconBase>
  )
}

// Sgorbia/utensile da intaglio: usata per lo step "Lavorazione a mano"
export function IconCraft(props) {
  return (
    <IconBase {...props}>
      <path d="M4 16l6-6 3 3-6 6H4v-3z" />
      <path d="M13 10l4-4 3 3-4 4" />
    </IconBase>
  )
}

// Goccia d'olio: usata per lo step "Finitura a olio"
export function IconOil(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
    </IconBase>
  )
}

// --- Icone "a schizzo", in stile lineart disegnato a mano ---
// Usate nella sezione "Il nostro processo": invece della linea unica e
// perfetta delle icone sopra, ogni forma è ripetuta due volte con un
// piccolo scarto (offset) e un tratto più sottile e semi-trasparente,
// per imitare il doppio tratto tipico di uno schizzo a matita fatto a
// mano libera. Ereditano il colore da "currentColor" (impostato ambra
// nel CSS della sezione, per un tocco caldo legno/ulivo).
function SketchIconBase({ children, ...props }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

// Ramo/tronco d'ulivo: usata per lo step "Il legno"
export function IconSketchWood(props) {
  return (
    <SketchIconBase {...props}>
      {/* Tratto "fantasma", leggermente spostato: dà l'effetto schizzo */}
      <g opacity="0.35" transform="translate(0.8, -0.6)">
        <path d="M6 27c3-6 3-11 8-15 3-3 4-6 8-8" />
        <path d="M12 17c1-1 3-1 4 0" />
      </g>
      {/* Tratto principale */}
      <path d="M5 26c3-6 4-10 9-14 3-3 4-7 8-9" />
      <path d="M11 16c1-1 3-1 4 0" />
      <path d="M16 10c1 0 2 1 2 2" />
      <ellipse cx="8.5" cy="21" rx="1.3" ry="0.9" transform="rotate(-30 8.5 21)" />
    </SketchIconBase>
  )
}

// Scalpello da falegname: usata per lo step "La lavorazione"
export function IconSketchChisel(props) {
  return (
    <SketchIconBase {...props}>
      <g opacity="0.35" transform="translate(-0.6, 0.7)">
        <path d="M7 27l9-9" />
        <path d="M16 18l8-8" />
      </g>
      <path d="M6 26l9-9" />
      <path d="M15 17l7-7" />
      <path d="M17 21l7-7" />
      <path d="M22 11l3 3" />
    </SketchIconBase>
  )
}

// Goccia d'olio: usata per lo step "La finitura"
export function IconSketchOil(props) {
  return (
    <SketchIconBase {...props}>
      <g opacity="0.35" transform="translate(0.7, 0.5)">
        <path d="M16 6s7 9 7 14a7 7 0 0 1-14 0c0-5 7-14 7-14z" />
      </g>
      <path d="M15 5s7 9 7 14a7 7 0 0 1-14 0c0-5 7-14 7-14z" />
    </SketchIconBase>
  )
}

// Cestino: usata per il bottone "rimuovi" nella pagina Carrello
export function IconTrash(props) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </IconBase>
  )
}

// --- Icone social, usate nel Footer (rappresentazioni semplificate,
// non i loghi ufficiali, per restare coerenti con lo stile "line icon"
// minimale usato in tutto il sito) ---

export function IconInstagram(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

export function IconFacebook(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14 8.5h-1.3a1.7 1.7 0 0 0-1.7 1.7V12H9v3h2v5h3v-5h2l.3-3h-2.3v-1.3c0-.4.3-.7.7-.7H14z" />
    </IconBase>
  )
}

export function IconPinterest(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8a3.2 3.2 0 0 0-1.2 6.2M12 8a3.2 3.2 0 0 1 0 6.4c-.4 0-.7 0-1-.1M11 17l1.3-6.3" />
    </IconBase>
  )
}
