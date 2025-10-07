import { Router } from "express";
import Joi from "joi";
import Manufacturer from "../models/Manufacturer.js";
import { validate } from "../utils/validate.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const items = await Manufacturer.find().sort({ name: 1 });
    res.set("Cache-Control", "public, max-age=300");
    res.json({ ok: true, data: items });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  validate(
    Joi.object({ body: Joi.object({ name: Joi.string().min(1).required() }) })
  ),
  async (req, res, next) => {
    try {
      const item = await Manufacturer.create({ name: req.body.name.trim() });
      res.status(201).json({ ok: true, data: item });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
