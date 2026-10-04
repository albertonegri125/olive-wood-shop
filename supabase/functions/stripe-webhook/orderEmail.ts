// supabase/functions/stripe-webhook/orderEmail.ts
//
// Email di conferma ordine inviata al cliente dal webhook Stripe, subito
// dopo la creazione dell'ordine, tramite Resend (https://resend.com).
//
// Secret necessari (supabase secrets set ..., vedi STRIPE_SETUP.md):
//   - RESEND_API_KEY: chiave API di Resend. Se manca, l'invio viene
//     saltato con un avviso nei log (l'ordine si registra comunque).
//   - RESEND_FROM (facoltativo): mittente, es.
//     "OliveWood Creations <ordini@tuodominio.it>". Il dominio deve essere
//     verificato su Resend. Se manca si usa l'indirizzo di test di Resend
//     (onboarding@resend.dev), che però consegna SOLO all'email con cui è
//     stato creato l'account Resend: va bene per le prove, non per i
//     clienti veri.
//   - SITE_URL (già usato da create-checkout-session): per il logo e il
//     link "I miei ordini" nell'email.
//
// Template HTML "da email": tabelle e stili inline, perché molti client
// (Gmail, Outlook) ignorano <style> e il layout con flex/grid. I colori
// sono quelli della palette del sito (src/index.css); i font del sito
// (Fraunces/Work Sans) non sono caricabili in modo affidabile in un'email,
// quindi hanno Georgia/Arial come alternativa.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'OliveWood Creations <onboarding@resend.dev>'

const COLORS = {
  bg: '#faf6f0',
  card: '#ffffff',
  text: '#2b1810',
  muted: '#7a6a5c',
  accent: '#c2542c',
  border: '#e8ddd0',
  secondary: '#4a5d3a',
}

const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif"
const SANS = "'Work Sans', Arial, Helvetica, sans-serif"

export type EmailLocale = 'it' | 'en'

export interface OrderEmailItem {
  name: string
  quantity: number
  unitPrice: number
}

export interface OrderEmailData {
  locale: EmailLocale
  to: string
  orderNumber: string
  items: OrderEmailItem[]
  subtotal: number
  discountPercentage: number
  discountAmount: number
  total: number
  shippingAddress: {
    name: string | null
    address: {
      line1?: string | null
      line2?: string | null
      postal_code?: string | null
      city?: string | null
      state?: string | null
      country?: string | null
    } | null
  } | null
  siteUrl: string | null
}

const TEXTS = {
  it: {
    subject: (orderNumber: string) => `Conferma ordine #${orderNumber} — OliveWood Creations`,
    preheader: 'Grazie per il tuo ordine: ecco il riepilogo.',
    title: 'Grazie per il tuo ordine!',
    intro:
      'Abbiamo ricevuto il tuo pagamento. Prepareremo il tuo pezzo con cura e ti avviseremo quando sarà spedito.',
    orderNumber: 'Numero ordine',
    summary: 'Riepilogo ordine',
    quantity: 'Quantità',
    subtotal: 'Subtotale',
    discount: (percentage: number) => `Sconto (${percentage}%)`,
    total: 'Totale pagato',
    shipping: 'Indirizzo di spedizione',
    noShipping: 'Indirizzo non disponibile: ti contatteremo per confermarlo.',
    ordersLink: 'Vedi i tuoi ordini',
    footer: 'Hai domande sul tuo ordine? Rispondi a questa email, ti risponderemo al più presto.',
    signature: 'OliveWood Creations',
    lang: 'it',
  },
  en: {
    subject: (orderNumber: string) => `Order confirmation #${orderNumber} — OliveWood Creations`,
    preheader: 'Thank you for your order: here is your summary.',
    title: 'Thank you for your order!',
    intro: "We've received your payment. We'll prepare your piece with care and let you know when it ships.",
    orderNumber: 'Order number',
    summary: 'Order summary',
    quantity: 'Quantity',
    subtotal: 'Subtotal',
    discount: (percentage: number) => `Discount (${percentage}%)`,
    total: 'Total paid',
    shipping: 'Shipping address',
    noShipping: "Address not available: we'll contact you to confirm it.",
    ordersLink: 'View your orders',
    footer: "Any questions about your order? Just reply to this email and we'll get back to you soon.",
    signature: 'OliveWood Creations',
    lang: 'en',
  },
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatPrice(value: number, locale: EmailLocale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-IE' : 'it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function addressLines(shippingAddress: OrderEmailData['shippingAddress']): string[] {
  const address = shippingAddress?.address
  if (!address) return []

  return [
    shippingAddress?.name,
    [address.line1, address.line2].filter(Boolean).join(', '),
    [address.postal_code, address.city, address.state].filter(Boolean).join(' '),
    address.country,
  ].filter((line): line is string => Boolean(line))
}

function buildHtml(data: OrderEmailData): string {
  const text = TEXTS[data.locale]
  const price = (value: number) => formatPrice(value, data.locale)
  const siteUrl = data.siteUrl?.replace(/\/+$/, '') ?? null

  const itemRows = data.items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${COLORS.border};font-family:${SANS};font-size:15px;color:${COLORS.text};">
            ${escapeHtml(item.name)}
            <div style="font-size:13px;color:${COLORS.muted};margin-top:2px;">${text.quantity}: ${item.quantity}</div>
          </td>
          <td align="right" style="padding:12px 0;border-bottom:1px solid ${COLORS.border};font-family:${SANS};font-size:15px;color:${COLORS.text};white-space:nowrap;vertical-align:top;">
            ${price(item.unitPrice * item.quantity)}
          </td>
        </tr>`
    )
    .join('')

  const discountRow =
    data.discountPercentage > 0 && data.discountAmount > 0
      ? `
        <tr>
          <td style="padding:4px 0;font-family:${SANS};font-size:14px;color:${COLORS.secondary};">${text.discount(data.discountPercentage)}</td>
          <td align="right" style="padding:4px 0;font-family:${SANS};font-size:14px;color:${COLORS.secondary};white-space:nowrap;">−${price(data.discountAmount)}</td>
        </tr>`
      : ''

  const lines = addressLines(data.shippingAddress)
  const addressHtml =
    lines.length > 0
      ? lines.map((line) => escapeHtml(line)).join('<br />')
      : `<span style="color:${COLORS.muted};">${text.noShipping}</span>`

  const logo = siteUrl
    ? `<img src="${escapeHtml(siteUrl)}/favicon.png" width="72" height="72" alt="OliveWood Creations" style="display:block;margin:0 auto 8px;border:0;width:72px;height:72px;" />`
    : ''

  const ordersButton = siteUrl
    ? `
        <tr>
          <td align="center" style="padding:8px 32px 32px;">
            <a href="${escapeHtml(siteUrl)}/account" style="display:inline-block;padding:12px 24px;background:${COLORS.accent};color:#ffffff;font-family:${SANS};font-size:15px;font-weight:600;text-decoration:none;border-radius:4px;">${text.ordersLink}</a>
          </td>
        </tr>`
    : ''

  return `<!doctype html>
<html lang="${text.lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(text.subject(data.orderNumber))}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${text.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding:0 0 24px;">
              ${logo}
              <div style="font-family:'Cormorant Garamond', Georgia, serif;font-size:26px;font-weight:600;color:#2b1f16;letter-spacing:0.02em;">OliveWood Creations</div>
            </td>
          </tr>
          <tr>
            <td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px 32px 8px;">
                    <h1 style="margin:0 0 12px;font-family:${SERIF};font-size:26px;font-weight:600;color:${COLORS.text};">${text.title}</h1>
                    <p style="margin:0 0 20px;font-family:${SANS};font-size:15px;line-height:1.6;color:${COLORS.text};">${text.intro}</p>
                    <p style="margin:0;font-family:${SANS};font-size:13px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.06em;">${text.orderNumber}</p>
                    <p style="margin:2px 0 0;font-family:Consolas, 'Courier New', monospace;font-size:18px;font-weight:700;color:${COLORS.accent};">#${escapeHtml(data.orderNumber)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 32px 8px;">
                    <h2 style="margin:0 0 4px;font-family:${SERIF};font-size:18px;font-weight:600;color:${COLORS.text};">${text.summary}</h2>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${itemRows}
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                      <tr>
                        <td style="padding:4px 0;font-family:${SANS};font-size:14px;color:${COLORS.muted};">${text.subtotal}</td>
                        <td align="right" style="padding:4px 0;font-family:${SANS};font-size:14px;color:${COLORS.muted};white-space:nowrap;">${price(data.subtotal)}</td>
                      </tr>
                      ${discountRow}
                      <tr>
                        <td style="padding:12px 0 0;border-top:1px solid ${COLORS.border};font-family:${SANS};font-size:16px;font-weight:700;color:${COLORS.text};">${text.total}</td>
                        <td align="right" style="padding:12px 0 0;border-top:1px solid ${COLORS.border};font-family:${SANS};font-size:16px;font-weight:700;color:${COLORS.text};white-space:nowrap;">${price(data.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 32px 24px;">
                    <h2 style="margin:0 0 8px;font-family:${SERIF};font-size:18px;font-weight:600;color:${COLORS.text};">${text.shipping}</h2>
                    <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${COLORS.text};">${addressHtml}</p>
                  </td>
                </tr>
                ${ordersButton}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 16px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${COLORS.muted};">
              ${text.footer}
              <br /><strong style="color:${COLORS.text};">${text.signature}</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Versione solo testo: alcuni client la mostrano al posto dell'HTML, e
// averla migliora la consegna (meno probabilità di finire nello spam).
function buildText(data: OrderEmailData): string {
  const text = TEXTS[data.locale]
  const price = (value: number) => formatPrice(value, data.locale)
  const lines = addressLines(data.shippingAddress)

  return [
    text.title,
    '',
    text.intro,
    '',
    `${text.orderNumber}: #${data.orderNumber}`,
    '',
    `${text.summary}:`,
    ...data.items.map((item) => `- ${item.name} × ${item.quantity}: ${price(item.unitPrice * item.quantity)}`),
    '',
    `${text.subtotal}: ${price(data.subtotal)}`,
    ...(data.discountPercentage > 0 && data.discountAmount > 0
      ? [`${text.discount(data.discountPercentage)}: −${price(data.discountAmount)}`]
      : []),
    `${text.total}: ${price(data.total)}`,
    '',
    `${text.shipping}:`,
    ...(lines.length > 0 ? lines : [text.noShipping]),
    '',
    ...(data.siteUrl ? [`${text.ordersLink}: ${data.siteUrl.replace(/\/+$/, '')}/account`, ''] : []),
    text.footer,
    '',
    text.signature,
  ].join('\n')
}

// Invia l'email. Lancia un errore se Resend risponde con un errore: chi la
// chiama (stripe-webhook) la avvolge in try/catch, così un problema con
// l'email non blocca mai la registrazione dell'ordine.
export async function sendOrderConfirmationEmail(data: OrderEmailData, apiKey: string, from?: string | null) {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from || DEFAULT_FROM,
      to: [data.to],
      subject: TEXTS[data.locale].subject(data.orderNumber),
      html: buildHtml(data),
      text: buildText(data),
    }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Resend ha risposto ${response.status}: ${details}`)
  }

  return (await response.json()) as { id: string }
}
