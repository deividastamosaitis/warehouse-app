import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    barcode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    manufacturer: { type: String, required: true, trim: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    quantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

ProductSchema.index({ name: "text", manufacturer: "text" });

export default mongoose.model("Product", ProductSchema);
