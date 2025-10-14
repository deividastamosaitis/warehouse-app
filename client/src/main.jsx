import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App";
import Scan from "./pages/Scan";
import Inventory from "./pages/Inventory";
import Admin from "./pages/Admin";
import Movements from "./pages/Movements";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/scan" replace />} />
          <Route path="scan" element={<Scan />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="movements" element={<Movements />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
