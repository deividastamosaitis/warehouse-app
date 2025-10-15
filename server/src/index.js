import express from "express";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");
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
const PORT = process.env.PORT || 4000;

// --- CORS START ---
const rawOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const norm = (o) => (o || "").replace(/\/$/, "").toLowerCase();
const allowed = new Set(rawOrigins.map(norm));
const allowAll = process.env.CORS_ALLOW_ALL === "true";

app.use(
  cors({
    origin(origin, cb) {
      if (allowAll || !origin) return cb(null, true); // DEMO / Postman
      const o = norm(origin);
      cb(
        allowed.has(o) ? null : new Error(`Not allowed by CORS: ${origin}`),
        allowed.has(o)
      );
    },
    credentials: true,
  })
);
// --- CORS END ---

// app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
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

// STATIC (FE build) – pateikiam React build'ą
app.use(express.static(clientDist));

// SPA FALLBACK be jokio "*" – viskam, kas NE prasideda /api/
app.use((req, res, next) => {
  // tik GET (nereikia trukdyti POST/PUT ir pan.)
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

// Klaidos handleris lieka gale
app.use(errorHandler);

const start = async () => {
  await connectDB(process.env.MONGODB_URI);
  app.listen(process.env.PORT, () =>
    console.log(`🚀 API klauso ${process.env.PORT}`)
  );
};

start();
