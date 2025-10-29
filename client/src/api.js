import axios from "axios";

/**
 * VITE_API_BASE gali būti:
 * - tuščias/neapibrėžtas  → naudosim "/api" (tas pats origin)
 * - "http://localhost:4100" → taps "http://localhost:4100/api"
 * - "/sandelys"             → taps "/sandelys/api"
 * - "http://srv:4100/api"   → paliks kaip yra (nes baigiasi /api)
 */
function normalizeBase(base) {
  if (!base) return "/api";
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) return trimmed;
  return `${trimmed}/api`;
}

const BASE = normalizeBase(import.meta.env.VITE_API_BASE);

export const api = axios.create({
  baseURL: BASE,
  withCredentials: true, // jei ateity reikės cookie auth
});

// ----- API wrappers -----
export const fetchGroups = () => api.get("/groups").then((r) => r.data.data);
export const fetchSuppliers = () =>
  api.get("/suppliers").then((r) => r.data.data);
export const fetchManufacturers = () =>
  api.get("/manufacturers").then((r) => r.data.data);

export const searchProducts = (params) =>
  api.get("/products", { params }).then((r) => r.data);
export const deleteProduct = (id) =>
  api.delete(`/products/${id}`).then((r) => r.data);
export const adjustQuantity = (id, delta, note = "") =>
  api
    .patch(`/products/${id}/quantity`, { delta, note })
    .then((r) => r.data.data);

export const intakeScan = (payload) =>
  api.post("/intake/scan", payload).then((r) => r.data.data);

export const getProductByBarcode = (barcode) =>
  api
    .get(`/products/barcode/${encodeURIComponent(barcode)}`)
    .then((r) => r.data.data);

export const fetchMovements = (params) =>
  api.get("/movements", { params }).then((r) => r.data);

export const fetchProductInvoices = (productId, limit = 5) =>
  api
    .get(`/products/${productId}/invoices`, { params: { limit } })
    .then((r) => r.data.data);

export const reserveBarcodes = (count = 1) =>
  api.post("/barcodes/reserve", { count }).then((r) => r.data.data);

export const assignBarcode = (productId, barcode, force = false) =>
  api
    .post(`/barcodes/assign/${productId}`, { barcode, force })
    .then((r) => r.data.data);
