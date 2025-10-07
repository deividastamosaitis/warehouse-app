import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    barcode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    manufacturer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Manufacturer",
      required: true,
    },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    quantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Paieškai – tik pavadinimas (lengvesnis tekstinis indeksas)
ProductSchema.index({ name: "text" });

// Naudojami filtrai/rikiavimai
ProductSchema.index({ group: 1, name: 1 });
ProductSchema.index({ supplier: 1, name: 1 });
ProductSchema.index({ manufacturer: 1, name: 1 });
ProductSchema.index({ quantity: -1 });
ProductSchema.index({ createdAt: -1 });

export default mongoose.model("Product", ProductSchema);
