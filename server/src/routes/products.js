import { Router } from "express";
import mongoose from "mongoose";
import Joi from "joi";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { validate } from "../utils/validate.js";

const router = Router();

function escapeRegex(s = "") {
  // pabėgam specialius simbolius, kad vartotojo įvestis nelaužytų regex
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Greita paieška pagal barkodą – be populate, lean + select
router.get(
  "/barcode/:barcode",
  validate(
    Joi.object({ params: Joi.object({ barcode: Joi.string().required() }) })
  ),
  async (req, res, next) => {
    try {
      const { barcode } = req.valid.params;
      const product = await Product.findOne({ barcode })
        .select("barcode name manufacturer group supplier quantity")
        .lean();
      if (!product)
        return res
          .status(404)
          .json({ ok: false, message: "Prekė su šiuo barkodu nerasta" });
      res.json({ ok: true, data: product });
    } catch (e) {
      next(e);
    }
  }
);
// GET /api/products/:id/invoices?limit=5  → paskutinės IN sąskaitos
router.get("/:id/invoices", async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit || 5);
    const productId = new mongoose.Types.ObjectId(id);

    const rows = await StockMovement.aggregate([
      {
        $match: {
          product: productId,
          type: "IN",
          invoiceNumber: { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$invoiceNumber",
          last: { $max: "$createdAt" },
          totalQty: { $sum: "$quantity" },
        },
      },
      { $sort: { last: -1 } },
      { $limit: limit },
      { $project: { _id: 0, invoiceNumber: "$_id", last: 1, totalQty: 1 } },
    ]);

    res.json({ ok: true, data: rows });
  } catch (e) {
    next(e);
  }
});

// Sąrašas + filtrai – lean + select, be populate
router.get(
  "/",
  validate(
    Joi.object({
      query: Joi.object({
        q: Joi.string().allow("").default(""),
        groupId: Joi.string().allow(""),
        supplierId: Joi.string().allow(""),
        manufacturerId: Joi.string().allow(""),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(200).default(50),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const { q, groupId, supplierId, manufacturerId, page, limit } =
        req.valid.query;

      const filter = {};

      // ✅ Substring paieška per kelis „gabaliukus“ (visi turi atitikti)
      if (q && q.trim()) {
        const tokens = q
          .split(/[\s\-_.]+/) // skaidom pagal tarpus, brūkšnelius, taškus ir pan.
          .filter(Boolean)
          .slice(0, 5); // saugiklis: iki 5 tokenų

        if (tokens.length) {
          filter.$and = tokens.map((t) => {
            const rx = new RegExp(escapeRegex(t), "i");
            return {
              $or: [
                { name: rx }, // DH-IPC-HDW2449T-S-PRO ras su "2449"
                { barcode: rx }, // leidžia ieškoti ir pagal barkodo gabalą
              ],
            };
          });
        }
      }

      if (groupId) filter.group = groupId;
      if (supplierId) filter.supplier = supplierId;
      if (manufacturerId) filter.manufacturer = manufacturerId;

      const [items, total] = await Promise.all([
        Product.find(filter)
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter),
      ]);

      res.json({
        ok: true,
        data: items,
        pagination: { total, page, limit },
      });
    } catch (e) {
      next(e);
    }
  }
);

// Kiekio korekcija – grąžinam minimalų objektą (be populate)
router.patch(
  "/:id/quantity",
  validate(
    Joi.object({
      params: Joi.object({ id: Joi.string().required() }),
      body: Joi.object({
        delta: Joi.number().integer().required(),
        note: Joi.string().allow("").optional(),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const { id } = req.valid.params;
      const { delta, note } = req.valid.body;
      const product = await Product.findById(id);
      if (!product)
        return res.status(404).json({ ok: false, message: "Prekė nerasta" });

      const newQty = product.quantity + delta;
      if (newQty < 0)
        return res
          .status(400)
          .json({ ok: false, message: "Kiekis negali tapti neigiamas" });

      await Product.updateOne({ _id: id }, { $inc: { quantity: delta } });
      await StockMovement.create({
        product: id,
        type: delta >= 0 ? "IN" : "OUT",
        quantity: Math.abs(delta),
        note,
      });

      const updated = await Product.findById(id)
        .select("barcode name quantity group supplier manufacturer")
        .lean();
      res.json({ ok: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
);

// Trinti
router.delete(
  "/:id",
  validate(Joi.object({ params: Joi.object({ id: Joi.string().required() }) })),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.valid.params.id)
        .select("_id quantity")
        .lean();
      if (!product)
        return res.status(404).json({ ok: false, message: "Prekė nerasta" });
      if (product.quantity > 0)
        return res.status(400).json({
          ok: false,
          message: "Pirma išimkite likutį (kiekis turi būti 0)",
        });

      await Product.deleteOne({ _id: product._id });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
