import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";

/**
 * Generate PDF labels (Code128) for provided codes.
 * @param {string[]} codes - barkodų sąrašas
 * @param {object} opts - maketas
 *   { pageW=210, pageH=297, labelW=54, labelH=25, margin=5, cols=3, rows=10, textSize=9 }
 *   matmenys mm (jsPDF 'mm' režimas)
 */
export async function generateLabelsPDF(codes, opts = {}) {
  const {
    pageW = 210,
    pageH = 297,
    labelW = 54,
    labelH = 25,
    margin = 5,
    cols = 3,
    rows = 10,
    textSize = 9,
  } = opts;

  const doc = new jsPDF({ unit: "mm", format: [pageW, pageH] });
  doc.setFontSize(textSize);

  // Pagalbos canvas barkodui nupiešti
  const canvas = document.createElement("canvas");

  const perPage = cols * rows;
  const pages = Math.ceil(codes.length / perPage);

  let idx = 0;
  for (let p = 0; p < pages; p++) {
    if (p > 0) doc.addPage();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (idx >= codes.length) break;
        const code = codes[idx++];

        // Brėžiam barkodą į canvas
        JsBarcode(canvas, code, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          height: 14 * 3, // ~42px
          width: 1.6, // linijos storis
        });
        const dataUrl = canvas.toDataURL("image/png");

        const x = margin + c * (labelW + margin);
        const y = margin + r * (labelH + margin);

        // Rėmelis (nebūtina) -> doc.rect(x, y, labelW, labelH);
        // Barkodas
        const barcodeW = labelW - 6; // šiek tiek paraščių
        const barcodeH = labelH - 10;
        doc.addImage(
          dataUrl,
          "PNG",
          x + 3,
          y + 4,
          barcodeW,
          Math.min(barcodeH, 18)
        );

        // Žmogiškas kodas žemiau
        doc.text(code, x + labelW / 2, y + labelH - 2, { align: "center" });
      }
    }
  }

  doc.save(`lipdukai_${new Date().toISOString().slice(0, 10)}.pdf`);
}
