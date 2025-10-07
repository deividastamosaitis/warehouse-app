import { Router } from "express";
import Joi from "joi";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { validate } from "../utils/validate.js";

const router = Router();

const bodySchema = Joi.object({
  barcode: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  name: Joi.string().allow("").optional(), // būtinas, jei kuriam naują
  manufacturerId: Joi.string().allow("").optional(), // būtinas, jei kuriam naują
  groupId: Joi.string().allow("").optional(),
  supplierId: Joi.string().allow("").optional(),
});

router.post(
  "/scan",
  validate(Joi.object({ body: bodySchema })),
  async (req, res, next) => {
    try {
      const { barcode, quantity, name, manufacturerId, groupId, supplierId } =
        req.valid.body;

      // Greita šaka – jei produktas jau yra
      const updated = await Product.findOneAndUpdate(
        { barcode },
        {
          $inc: { quantity },
          ...(groupId ? { $set: { group: groupId } } : {}),
          ...(supplierId ? { $set: { supplier: supplierId } } : {}),
        },
        {
          new: true,
          projection: "barcode name quantity group supplier manufacturer",
          lean: true,
        }
      );

      let product = updated;

      // Jei nebuvo – kuriam naują (reikia name + manufacturerId)
      if (!product) {
        if (!name || !manufacturerId) {
          return res
            .status(400)
            .json({
              ok: false,
              message: "Naujam produktui būtini pavadinimas ir gamintojas",
            });
        }
        const created = await Product.create({
          barcode,
          name: name.trim(),
          manufacturer: manufacturerId,
          group: groupId || undefined,
          supplier: supplierId || undefined,
          quantity,
        });
        product = {
          _id: created._id,
          barcode: created.barcode,
          name: created.name,
          quantity: created.quantity,
          group: created.group || null,
          supplier: created.supplier || null,
          manufacturer: created.manufacturer,
        };
      }

      await StockMovement.create({
        product: product._id,
        type: "IN",
        quantity,
        supplier: supplierId || undefined,
        note: "Priėmimas pagal skenavimą",
      });

      res.status(201).json({ ok: true, data: product });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
