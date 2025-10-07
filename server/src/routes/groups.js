import { Router } from "express";
import Joi from "joi";
import Group from "../models/Group.js";
import { validate } from "../utils/validate.js";

const router = Router();

// GET /api/groups – visos grupės (rikiuojamos pagal pavadinimą)
router.get("/", async (req, res, next) => {
  try {
    const items = await Group.find().sort({ name: 1 });
    res.json({ ok: true, data: items });
  } catch (e) {
    next(e);
  }
});

// POST /api/groups – pridėti naują grupę
router.post(
  "/",
  validate(
    Joi.object({
      body: Joi.object({
        name: Joi.string().min(1).required(),
      }),
    })
  ),
  async (req, res, next) => {
    try {
      const item = await Group.create({ name: req.body.name.trim() });
      res.status(201).json({ ok: true, data: item });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
