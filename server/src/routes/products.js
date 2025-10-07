import { Router } from "express";
import Joi from "joi";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { validate } from "../utils/validate.js";

const router = Router();

// GET /api/products?q=&groupId=&supplierId=&manufacturer=&page=&limit=&sort=
router.get(
  "/",
  validate(
    Joi.object({
      query: Joi.object({
        q: Joi.string().allow("").optional(),
        groupId: Joi.string().allow("").optional(),
        supplierId: Joi.string().allow("").optional(),
        manufacturer: Joi.string().allow("").optional(),
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
      let { q, groupId, supplierId, manufacturer, page, limit, sort } =
        req.valid.query;

      // Konvertuojam tuščius į undefined
      q = q?.trim() || undefined;
      groupId = groupId || undefined;
      supplierId = supplierId || undefined;
      manufacturer = manufacturer?.trim() || undefined;

      const filter = {};
      if (q) filter.$text = { $search: q };
      if (groupId) filter.group = groupId;
      if (supplierId) filter.supplier = supplierId;
      if (manufacturer) filter.manufacturer = new RegExp(manufacturer, "i");

      const projection = q ? { score: { $meta: "textScore" } } : {};
      const cursor = Product.find(filter, projection)
        .populate("group", "name")
        .populate("supplier", "name");

      if (q) cursor.sort({ score: { $meta: "textScore" } });
      else cursor.sort({ [sort]: 1 });

      const total = await Product.countDocuments(filter);
      const items = await cursor.skip((page - 1) * limit).limit(limit);

      res.json({ ok: true, data: items, pagination: { total, page, limit } });
    } catch (e) {
      next(e);
    }
  }
);

// PATCH /api/products/:id/quantity
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

      product.quantity = newQty;
      await product.save();

      await StockMovement.create({
        product: product._id,
        type: delta >= 0 ? "IN" : "OUT",
        quantity: Math.abs(delta),
        note,
      });

      res.json({ ok: true, data: product });
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /api/products/:id
router.delete(
  "/:id",
  validate(Joi.object({ params: Joi.object({ id: Joi.string().required() }) })),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.valid.params.id);
      if (!product)
        return res.status(404).json({ ok: false, message: "Prekė nerasta" });
      if (product.quantity > 0)
        return res
          .status(400)
          .json({
            ok: false,
            message: "Pirma išimkite likutį (kiekis turi būti 0)",
          });

      await product.deleteOne();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
