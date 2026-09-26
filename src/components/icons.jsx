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

// Cerchio con spunta: usata per il badge "Pezzo esatto in foto"
export function IconCheck(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </IconBase>
  )
}

// Cerchio con "i": usata per il badge "Pezzo simile alla foto"
export function IconInfo(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6v.1" />
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

// Stella piena: usata per il punteggio (rating) delle recensioni clienti.
// A differenza delle altre icone qui il riempimento è "currentColor" (non
// solo il contorno): acceso/spento delle singole stelle è deciso dal CSS
// del componente che la usa (vedi StarRating.jsx), non da questa icona.
export function IconStar(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.6L12 17.6l-5.8 3 1.1-6.6-4.8-4.6 6.6-.9z" />
    </svg>
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

// --- Icone dei provider di login social (Google/Apple) ---
// A differenza delle altre icone del sito, qui riproduciamo i loghi
// ufficiali (non uno stile "line icon" personalizzato): le linee guida di
// branding di entrambi i provider richiedono di mostrare il logo così
// com'è, senza reinterpretarlo, perché resti immediatamente riconoscibile.

// Logo Google (la "G" multicolore ufficiale): usato nel bottone "Continua
// con Google", su sfondo bianco come da linee guida.
export function IconGoogleLogo(props) {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

// Logo Apple (la mela stilizzata): usato nel bottone "Continua con Apple",
// bianco su sfondo nero come da Apple Human Interface Guidelines.
// "fill=currentColor" perché eredita il bianco dal testo del bottone.
export function IconAppleLogo(props) {
  return (
    <svg
      viewBox="0 0 170 170"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.197-2.12-9.973-3.17-14.34-3.17-4.58 0-9.492 1.05-14.746 3.17-5.262 2.13-9.501 3.24-12.742 3.35-4.929.21-9.842-1.96-14.746-6.52-3.13-2.73-7.045-7.41-11.735-14.04-5.032-7.08-9.17-15.29-12.41-24.65-3.471-10.11-5.211-19.9-5.211-29.378 0-10.857 2.346-20.221 7.045-28.068 3.693-6.303 8.606-11.275 14.755-14.925 6.149-3.65 12.793-5.51 19.948-5.629 3.915 0 9.049 1.211 15.429 3.591 6.362 2.388 10.447 3.599 12.238 3.599 1.339 0 5.877-1.416 13.57-4.239 7.275-2.618 13.415-3.702 18.445-3.275 13.63 1.1 23.87 6.473 30.68 16.153-12.19 7.386-18.22 17.731-18.1 31.002.11 10.336 3.86 18.939 11.23 25.769 3.34 3.17 7.07 5.62 11.22 7.36-.9 2.61-1.85 5.11-2.86 7.51zM119.11 7.24c0 8.102-2.96 15.667-8.86 22.669-7.12 8.324-15.732 13.134-25.071 12.375a25.222 25.222 0 0 1-.188-3.07c0-7.778 3.386-16.102 9.399-22.908 3.002-3.446 6.82-6.311 11.45-8.597 4.62-2.253 8.99-3.499 13.1-3.71.12 1.083.17 2.166.17 3.24z" />
    </svg>
  )
}
