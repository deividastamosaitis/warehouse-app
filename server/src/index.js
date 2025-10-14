import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import compression from "compression";
import { connectDB } from "./db.js";
import { errorHandler } from "./middleware/error.js";

import products from "./routes/products.js";
import intake from "./routes/intake.js";
import groups from "./routes/groups.js";
import suppliers from "./routes/suppliers.js";
import manufacturers from "./routes/manufacturers.js";
import movements from "./routes/movements.js";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(compression({ level: 6 }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/products", products);
app.use("/api/intake", intake);
app.use("/api/groups", groups);
app.use("/api/suppliers", suppliers);
app.use("/api/manufacturers", manufacturers);
app.use("/api/movements", movements);

app.use(errorHandler);

const start = async () => {
  await connectDB(process.env.MONGODB_URI);
  app.listen(process.env.PORT, () =>
    console.log(`🚀 API klauso ${process.env.PORT}`)
  );
};

start();
