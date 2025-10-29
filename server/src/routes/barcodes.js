import { Router } from "express";
import Product from "../models/Product.js";
import { reserveWarehouseCodes } from "../utils/barcode.js";

const router = Router();

/**
 * POST /api/barcodes/reserve
 * body: { count?: number }
 * -> { data: string[] } pvz. ["W-2025-00012", "W-2025-00013"]
 */
router.post("/reserve", async (req, res, next) => {
  try {
    const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 500);
    const codes = await reserveWarehouseCodes(count);

    // saugiklis: ar kas nors jau su tuo barkodu egzistuoja
    const exist = await Product.find(
      { barcode: { $in: codes } },
      "barcode"
    ).lean();
    if (exist.length > 0) {
      return res
        .status(409)
        .json({
          message: `Kai kurie barkodai jau naudojami: ${exist
            .map((x) => x.barcode)
            .join(", ")}`,
        });
    }

    res.json({ data: codes });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/barcodes/assign/:productId
 * body: { barcode: string, force?: boolean }
 * -> priskiria konkretų barkodą prekei (unikalumo patikra)
 */
router.post("/assign/:productId", async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { barcode, force = false } = req.body || {};
    if (!barcode)
      return res.status(400).json({ message: "Trūksta 'barcode'." });

    const p = await Product.findById(productId);
    if (!p) return res.status(404).json({ message: "Prekė nerasta." });

    if (!force && p.barcode && p.barcode !== barcode) {
      return res
        .status(409)
        .json({ message: "Šiai prekei jau priskirtas barkodas." });
    }

    const used = await Product.findOne(
      { barcode, _id: { $ne: p._id } },
      "_id"
    ).lean();
    if (used)
      return res
        .status(409)
        .json({ message: "Toks barkodas jau naudojamas kitai prekei." });

    p.barcode = barcode;
    await p.save();

    res.json({ data: { _id: p._id, barcode: p.barcode, name: p.name } });
  } catch (e) {
    if (e?.code === 11000)
      return res.status(409).json({ message: "Barkodas jau naudojamas." });
    next(e);
  }
});

export default router;
