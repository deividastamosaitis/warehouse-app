import { Outlet, NavLink } from "react-router-dom";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4">
        <Outlet />
      </div>
    </div>
  );
}
