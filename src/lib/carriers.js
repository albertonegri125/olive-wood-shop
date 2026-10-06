export const SHIPPING_CARRIERS = [
  { value: 'brt', labelKey: 'adminOrders.detail.carriers.brt' },
  { value: 'gls', labelKey: 'adminOrders.detail.carriers.gls' },
  { value: 'sda', labelKey: 'adminOrders.detail.carriers.sda' },
  { value: 'poste_italiane', labelKey: 'adminOrders.detail.carriers.poste_italiane' },
  { value: 'dhl', labelKey: 'adminOrders.detail.carriers.dhl' },
  { value: 'ups', labelKey: 'adminOrders.detail.carriers.ups' },
  { value: 'fedex', labelKey: 'adminOrders.detail.carriers.fedex' },
  { value: 'other', labelKey: 'adminOrders.detail.carriers.other' },
]

// Official carrier tracking pages. Some portals accept the tracking number
// in their URL; for the others this opens the official search page.
const TRACKING_URL_TEMPLATES = {
  brt: 'https://vas.brt.it/vas/sped_det_show.htm?referer=sped_numspe_par.htm&nsped={trackingNumber}',
  gls: 'https://gls-group.com/IT/it/servizi-online/ricerca-spedizioni/',
  sda: 'https://www.poste.it/cerca/index.html',
  poste_italiane: 'https://www.poste.it/cerca/index.html',
  dhl: 'https://www.dhl.com/it-it/home/tracking.html?tracking-id={trackingNumber}',
  ups: 'https://www.ups.com/track?loc=it_IT&tracknum={trackingNumber}',
  fedex: 'https://www.fedex.com/fedextrack/?trknbr={trackingNumber}&locale=it_IT',
}

export function createCarrierTrackingUrl(carrier, trackingNumber) {
  const template = TRACKING_URL_TEMPLATES[carrier]
  const number = typeof trackingNumber === 'string' ? trackingNumber.trim() : ''
  if (!template || !number) return ''

  return template.replace('{trackingNumber}', encodeURIComponent(number))
}

export function isHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim().toLowerCase().startsWith('https://')) {
    return false
  }

  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
