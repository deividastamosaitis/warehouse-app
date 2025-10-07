import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

export const fetchGroups = () => api.get("/groups").then((r) => r.data.data);
export const fetchSuppliers = () =>
  api.get("/suppliers").then((r) => r.data.data);
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
