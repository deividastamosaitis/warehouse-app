import { Router } from "express";
import Joi from "joi";
import StockMovement from "../models/StockMovement.js";
import { validate } from "../utils/validate.js";

const router = Router();

router.get(
  "/",
  validate(
    Joi.object({
      query: Joi.object({
        productId: Joi.string().allow("").optional(),
        type: Joi.string().valid("IN", "OUT").allow("").optional(),
        invoice: Joi.string().allow("").optional(),
        dateFrom: Joi.string().isoDate().allow("").optional(),
        dateTo: Joi.string().isoDate().allow("").optional(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(200).default(50),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      let { productId, type, invoice, dateFrom, dateTo, page, limit } =
        req.valid.query;

      const filter = {};
      if (productId) filter.product = productId;
      if (type) filter.type = type;
      if (invoice) filter.invoiceNumber = new RegExp(invoice.trim(), "i");
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }

      const total = await StockMovement.countDocuments(filter);
      const items = await StockMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("product", "barcode name") // rodom tik tiek
        .lean();

      res.json({ ok: true, data: items, pagination: { total, page, limit } });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
