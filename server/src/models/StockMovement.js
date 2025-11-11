import mongoose from "mongoose";

const StockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["IN", "OUT"], required: true, index: true },
    quantity: { type: Number, required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    note: { type: String, default: "" },
    invoiceNumber: { type: String, trim: true, default: "" },
    source: {
      type: String,
    },

    clientName: {
      type: String,
    },
    clientPhone: {
      type: String,
    },

    totalAmount: {
      type: Number,
    },

    receiptNumber: {
      type: String,
    },

    saleInvoiceNumber: {
      type: String,
    },

    garantinisId: {
      type: String,
    },
    createdById: String,
    createdByName: String,
  },
  { timestamps: true }
);

StockMovementSchema.index({ createdAt: -1 });
StockMovementSchema.index({ product: 1, createdAt: -1 });
// Greitas filtravimas
StockMovementSchema.index(
  { invoiceNumber: 1 },
  { partialFilterExpression: { invoiceNumber: { $exists: true, $ne: "" } } }
);

// Greitam "produkto X turi tokia saskaita" tikrinimui (naudojam aggregate $lookup)
StockMovementSchema.index(
  { product: 1, invoiceNumber: 1 },
  { partialFilterExpression: { invoiceNumber: { $exists: true, $ne: "" } } }
);

StockMovementSchema.index(
  { invoiceNumber: 1, type: 1 },
  { partialFilterExpression: { invoiceNumber: { $exists: true, $ne: "" } } }
);

export default mongoose.model("StockMovement", StockMovementSchema);
