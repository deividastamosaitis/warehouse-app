import { Router } from "express";
import Joi from "joi";
import mongoose from "mongoose";
import StockMovement from "../models/StockMovement.js";
import { validate } from "../utils/validate.js";

const router = Router();

function escapeRegex(s = "") {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// YYYY-MM-DD -> visos dienos pradžia/pabaiga (UTC)
function toDayStart(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}
function toDayEnd(dateStr) {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

router.get(
  "/",
  validate(
    Joi.object({
      query: Joi.object({
        // NAUJA: laukas "q" paieškai pagal produkto pavadinimą/barkodą
        q: Joi.string().allow("").optional(),
        productId: Joi.string().allow("").optional(),
        type: Joi.string().valid("IN", "OUT").allow("").optional(),
        invoice: Joi.string().allow("").optional(),
        // Pastaba: nenaudojam .isoDate(), nes input type="date" paduoda YYYY-MM-DD
        dateFrom: Joi.string()
          .pattern(/^\d{4}-\d{2}-\d{2}$/)
          .allow("")
          .optional(),
        dateTo: Joi.string()
          .pattern(/^\d{4}-\d{2}-\d{2}$/)
          .allow("")
          .optional(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(200).default(50),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      let { q, productId, type, invoice, dateFrom, dateTo, page, limit } =
        req.valid.query;

      // Bendri filtrai ant StockMovement
      const baseMatch = {};
      if (productId) baseMatch.product = new mongoose.Types.ObjectId(productId);
      if (type) baseMatch.type = type;
      if (invoice)
        baseMatch.invoiceNumber = {
          $regex: escapeRegex(invoice.trim()),
          $options: "i",
        };
      if (dateFrom || dateTo) {
        baseMatch.createdAt = {};
        if (dateFrom) baseMatch.createdAt.$gte = toDayStart(dateFrom);
        if (dateTo) baseMatch.createdAt.$lte = toDayEnd(dateTo);
      }

      // Jei nėra q (paieškos pagal pavadinimą/barkodą) — galim daryti paprastą find+populate (greičiau)
      if (!q || !q.trim()) {
        const [items, total] = await Promise.all([
          StockMovement.find(baseMatch)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("product", "name barcode")
            .lean(),
          StockMovement.countDocuments(baseMatch),
        ]);
        return res.json({
          ok: true,
          data: items,
          pagination: { total, page, limit },
        });
      }

      // Jei yra q — reikia match'inti ant produkto name/barcode → darom aggregate su $lookup
      const tokens = q
        .split(/[\s\-_.]+/)
        .filter(Boolean)
        .slice(0, 5);
      const tokenClauses = tokens.map((t) => ({
        $or: [
          { "prod.name": { $regex: escapeRegex(t), $options: "i" } },
          { "prod.barcode": { $regex: escapeRegex(t), $options: "i" } },
        ],
      }));

      const pipeline = [
        { $match: baseMatch },
        {
          $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            as: "prod",
          },
        },
        { $unwind: { path: "$prod", preserveNullAndEmptyArrays: false } },
        ...(tokenClauses.length ? [{ $match: { $and: tokenClauses } }] : []),
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            data: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  type: 1,
                  quantity: 1,
                  invoiceNumber: 1,
                  createdAt: 1,
                  product: {
                    name: "$prod.name",
                    barcode: "$prod.barcode",
                  },
                },
              },
            ],
            meta: [{ $count: "total" }],
          },
        },
      ];

      const resArr = await StockMovement.aggregate(pipeline);
      const data = resArr[0]?.data || [];
      const total = resArr[0]?.meta?.[0]?.total || 0;

      res.json({ ok: true, data, pagination: { total, page, limit } });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
