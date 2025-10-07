import { Router } from "express";
import Joi from "joi";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { validate } from "../utils/validate.js";

const router = Router();

const bodySchema = Joi.object({
  barcode: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  name: Joi.string().allow("").optional(), // privaloma jei nauja prekė
  manufacturer: Joi.string().allow("").optional(), // privaloma jei nauja prekė
  groupId: Joi.string().allow("").optional(),
  supplierId: Joi.string().allow("").optional(),
});

router.post(
  "/scan",
  validate(Joi.object({ body: bodySchema })),
  async (req, res, next) => {
    try {
      const { barcode, quantity, name, manufacturer, groupId, supplierId } =
        req.valid.body;

      let product = await Product.findOne({ barcode });

      if (product) {
        // egzistuoja – nekeičiam pavadinimo/gamintojo
        product.quantity += quantity;
        if (groupId) product.group = groupId;
        if (supplierId) product.supplier = supplierId;
        await product.save();
      } else {
        if (!name || !manufacturer)
          return res
            .status(400)
            .json({
              ok: false,
              message: "Naujam produktui būtini pavadinimas ir gamintojas",
            });
        product = await Product.create({
          barcode,
          name: name.trim(),
          manufacturer: manufacturer.trim(),
          group: groupId || undefined,
          supplier: supplierId || undefined,
          quantity,
        });
      }

      await StockMovement.create({
        product: product._id,
        type: "IN",
        quantity,
        supplier: supplierId || undefined,
        note: "Priėmimas pagal skenavimą",
      });

      product = await product.populate("group", "name");
      product = await product.populate("supplier", "name");

      res.status(201).json({ ok: true, data: product });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
