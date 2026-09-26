// src/lib/printLabel.js
//
// Apre una finestra separata con l'etichetta di magazzino di un prodotto
// (SKU in grande + nome), dimensionata per un'etichetta adesiva 60x40mm, e
// avvia la stampa (window.print()).
//
// Finestra separata invece di un foglio di stile @media print nella pagina
// admin: la regola "@page { size: 60mm 40mm }" vale per l'intero documento
// in cui è caricata. In una SPA resterebbe attiva anche dopo aver cambiato
// pagina, e qualunque altra stampa del sito uscirebbe in formato etichetta.
// Qui invece vive solo nel documento della finestra dell'etichetta.
//
// Restituisce false se il browser ha bloccato l'apertura della finestra
// (popup blocker), così chi chiama può avvisare l'admin.

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function printProductLabel({ sku, name }) {
  const labelWindow = window.open('', '_blank', 'width=480,height=360')
  if (!labelWindow) return false

  // Dimensioni in mm, pensate per 60x40mm con 3mm di margine interno:
  // - SKU ("CUC-2026-0001", 13 caratteri) in monospace a 16pt: ~48mm di
  //   larghezza, entra nei 54mm utili senza andare a capo.
  // - Nome a 9pt, al massimo 3 righe (poi tagliato con "…"), così un nome
  //   molto lungo non spinge mai lo SKU fuori dall'etichetta.
  labelWindow.document.write(`<!doctype html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(sku)}</title>
<style>
  @page { size: 60mm 40mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  .label {
    width: 60mm;
    height: 40mm;
    padding: 3mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2.5mm;
    overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
  }
  .label-sku {
    font-family: ui-monospace, Consolas, 'Courier New', monospace;
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1.1;
    white-space: nowrap;
  }
  .label-name {
    font-size: 9pt;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  @media screen {
    body { padding: 16px; background: #eee; }
    .label { background: #fff; outline: 1px dashed #999; }
  }
</style>
</head>
<body>
  <div class="label">
    <div class="label-sku">${escapeHtml(sku)}</div>
    <div class="label-name">${escapeHtml(name)}</div>
  </div>
  <script>
    window.addEventListener('afterprint', function () { window.close(); });
    window.addEventListener('load', function () { window.focus(); window.print(); });
  </script>
</body>
</html>`)
  labelWindow.document.close()

  return true
}
