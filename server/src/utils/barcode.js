import { nextSeq } from "./sequence.js";

export async function reserveWarehouseCodes(count = 1) {
  const year = new Date().getFullYear();
  const key = `barcode_${year}`;
  const out = [];
  for (let i = 0; i < Math.max(1, Number(count) || 1); i++) {
    const n = await nextSeq(key);
    const code = `W-${year}-${String(n).padStart(5, "0")}`; // pvz. W-2025-00001
    out.push(code);
  }
  return out;
}
