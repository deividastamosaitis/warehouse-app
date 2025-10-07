import { Router } from "express";
import Joi from "joi";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { validate } from "../utils/validate.js";

const router = Router();

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

// Sąrašas + filtrai – lean + select, be populate
router.get(
  "/",
  validate(
    Joi.object({
      query: Joi.object({
        q: Joi.string().allow("").optional(),
        groupId: Joi.string().allow("").optional(),
        supplierId: Joi.string().allow("").optional(),
        manufacturerId: Joi.string().allow("").optional(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        sort: Joi.string()
          .valid("name", "quantity", "createdAt")
          .default("name"),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      let { q, groupId, supplierId, manufacturerId, page, limit, sort } =
        req.valid.query;
      q = q?.trim() || undefined;
      groupId = groupId || undefined;
      supplierId = supplierId || undefined;
      manufacturerId = manufacturerId || undefined;

      const filter = {};
      if (q) filter.$text = { $search: q };
      if (groupId) filter.group = groupId;
      if (supplierId) filter.supplier = supplierId;
      if (manufacturerId) filter.manufacturer = manufacturerId;

      const projection = q ? { score: { $meta: "textScore" } } : {};
      let cursor = Product.find(filter, projection)
        .select("barcode name quantity group supplier manufacturer")
        .lean();

      if (q) cursor = cursor.sort({ score: { $meta: "textScore" } });
      else cursor = cursor.sort({ [sort]: 1 });

      const total = await Product.countDocuments(filter);
      const items = await cursor.skip((page - 1) * limit).limit(limit);

      res.json({ ok: true, data: items, pagination: { total, page, limit } });
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
        return res
          .status(400)
          .json({
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
