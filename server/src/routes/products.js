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
        invoice: Joi.string().allow("").default(""), // <— nauja
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(200).default(50),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const { q, groupId, supplierId, manufacturerId, invoice, page, limit } =
        req.valid.query;

      // Bazinis produktų filtras
      const baseMatch = {};
      if (groupId) baseMatch.group = groupId;
      if (supplierId) baseMatch.supplier = supplierId;
      if (manufacturerId) baseMatch.manufacturer = manufacturerId;

      // Substring paieška per tokenus (pavadinimas arba barkodas)
      if (q && q.trim()) {
        const tokens = q
          .split(/[\s\-_.]+/)
          .filter(Boolean)
          .slice(0, 5);
        if (tokens.length) {
          baseMatch.$and = tokens.map((t) => {
            const rx = new RegExp(escapeRegex(t), "i");
            return { $or: [{ name: rx }, { barcode: rx }] };
          });
        }
      }

      // Jei nėra sąskaitos filtro — paprasta find + count
      if (!invoice || !invoice.trim()) {
        const [items, total] = await Promise.all([
          Product.find(baseMatch)
            .sort({ name: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          Product.countDocuments(baseMatch),
        ]);
        return res.json({
          ok: true,
          data: items,
          pagination: { total, page, limit },
        });
      }

      // Yra sąskaitos filtras — naudojam aggregate su lookup į StockMovement
      const inv = invoice.trim();

      const pipeline = [
        { $match: baseMatch },
        {
          $lookup: {
            from: "stockmovements",
            let: { pid: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$product", "$$pid"] },
                  type: "IN",
                  invoiceNumber: inv,
                },
              },
              { $limit: 1 },
            ],
            as: "mov",
          },
        },
        { $match: { mov: { $ne: [] } } }, // paliekam tik tuos, kurie turi IN su ta sąskaita
        { $sort: { name: 1 } },
        {
          $facet: {
            data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
            meta: [{ $count: "total" }],
          },
        },
      ];

      const result = await Product.aggregate(pipeline);
      const data = result[0]?.data || [];
      const total = result[0]?.meta?.[0]?.total || 0;

      res.json({ ok: true, data, pagination: { total, page, limit } });
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

        // NAUJI laukai iš garantinio
        source: Joi.string().allow("").optional(),
        clientName: Joi.string().allow("").optional(),
        clientPhone: Joi.string().allow("").optional(),
        totalAmount: Joi.number().optional(),
        receiptNumber: Joi.string().allow("").optional(),
        saleInvoiceNumber: Joi.string().allow("").optional(),
        garantinisId: Joi.string().allow("").optional(),
        createdById: Joi.string().allow("").optional(),
        createdByName: Joi.string().allow("").optional(),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const { id } = req.valid.params;
      const {
        delta,
        note,
        source,
        clientName,
        clientPhone,
        totalAmount,
        receiptNumber,
        saleInvoiceNumber,
        garantinisId,
        createdById,
        createdByName,
      } = req.valid.body;

      const product = await Product.findById(id);
      if (!product)
        return res.status(404).json({ ok: false, message: "Prekė nerasta" });

      const newQty = product.quantity + delta;

      // A variantas: NELEISTI minuso
      if (newQty < 0) {
        return res
          .status(400)
          .json({ ok: false, message: "Kiekis negali tapti neigiamas" });
      }

      await Product.updateOne({ _id: id }, { $inc: { quantity: delta } });

      await StockMovement.create({
        product: id,
        type: delta >= 0 ? "IN" : "OUT",
        quantity: Math.abs(delta),
        note,

        // iš garantinio (jei buvo paduota)
        source,
        clientName,
        clientPhone,
        totalAmount,
        receiptNumber,
        saleInvoiceNumber,
        garantinisId,

        // jei nori OUT sąskaitą jungti prie bendro invoiceNumber:
        ...(saleInvoiceNumber && { invoiceNumber: saleInvoiceNumber }),
        createdById,
        createdByName,
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
