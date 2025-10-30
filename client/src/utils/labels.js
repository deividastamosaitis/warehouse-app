// utils/labels.js
import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";

/**
 * Vienas barkodas -> vienas PDF failas (Brother DK-11201: 90 × 29 mm).
 * TIPAI spausdinant:
 *  - Printer: Brother QL-700
 *  - Paper: DK-11201 (29x90mm) / Custom 90 x 29 mm
 *  - Scale: 100% (Actual size)
 *  - Margins: None
 *  - Orientation: Landscape (jei klausia)
 */
export async function generateDK11201Label(code, opts = {}) {
  const {
    pageW = 90, // mm (plotis)
    pageH = 29, // mm (aukštis)
    quietX = 3, // šoniniai tarpai (mm)
    quietY = 2, // viršus/apačia (mm)
    showText = true,
    textSize = 9, // jsPDF font size
    barcodeMaxH = 18, // maksimalus barkodo aukštis (mm)
    pxPerMm = 8, // kanvas raiška (aukšta – aiškios linijos)
    offsetX = 0, // mm – jei reikės centruoti spausdinant
    offsetY = 0, // mm
  } = opts;

  // Priverstinai landscape su custom formatu [width, height] mm
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [pageW, pageH],
    compress: true,
  });

  // Braižymo sritis (be „ramybės“ kraštų)
  const drawW = pageW - quietX * 2;
  let drawH = pageH - quietY * 2;

  // jei rodysim tekstą – paliekam jam vietos apačioje
  let textH = 0;
  if (showText) {
    textH = Math.max(4, textSize + 2);
    drawH = Math.max(6, drawH - textH);
  }
  const barcodeWmm = drawW;
  const barcodeHmm = Math.min(barcodeMaxH, drawH);

  // Paruošiam aukštos raiškos canvas
  const cW = Math.round(barcodeWmm * pxPerMm);
  const cH = Math.round(barcodeHmm * pxPerMm);
  const canvas = document.createElement("canvas");
  canvas.width = cW;
  canvas.height = cH;

  // Generuojam barkodą (be teksto – tekstą rašys jsPDF)
  JsBarcode(canvas, String(code), {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    width: Math.max(1, Math.floor(cW / 220)), // adaptuojamas linijos plotis
    height: cH,
    lineColor: "#000000",
  });

  const dataUrl = canvas.toDataURL("image/png");

  // Centruojam barkodą (horizontaliai) ir dedam „ramybės“ nuo kraštų
  const x = quietX + offsetX;
  const y = quietY + offsetY;

  // Piešiam barkodą
  doc.addImage(dataUrl, "PNG", x, y, barcodeWmm, barcodeHmm);

  // Žmogiškas kodas apačioje (neprivaloma)
  if (showText) {
    doc.setFontSize(textSize);
    doc.text(String(code), pageW / 2 + offsetX, y + barcodeHmm + (textH - 1), {
      align: "center",
      baseline: "bottom",
    });
  }

  doc.save(`label_${String(code)}.pdf`);
}

/**
 * Patogumas: jei nori iškart daug kodų – sugeneruoja
 * atskirus PDF failus (vienas kodas = vienas failas).
 * Naršyklė paprašys leisti daugkartinius „download“.
 */
export async function generateDK11201Labels(codes, opts = {}) {
  for (const c of codes) {
    await generateDK11201Label(c, opts);
  }
}
