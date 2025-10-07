import mongoose from "mongoose";

const StockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    type: { type: String, enum: ["IN", "OUT", "ADJUST"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
  },
  { timestamps: true }
);

export default mongoose.model("StockMovement", StockMovementSchema);
