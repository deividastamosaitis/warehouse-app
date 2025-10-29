import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // pvz. 'barcode_2025'
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Counter", CounterSchema);
