import { NavLink } from "react-router-dom";

const link = ({ isActive }) =>
  `px-4 py-2 rounded-2xl ${
    isActive ? "bg-gray-900 text-white" : "hover:bg-gray-200"
  }`;

export default function Navbar() {
  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="max-w-6xl mx-auto p-4 flex items-center gap-3">
        <div className="font-bold text-xl">Sandėlis</div>
        <div className="flex gap-2">
          <NavLink to="/scan" className={link}>
            Skenuoti
          </NavLink>
          <NavLink to="/inventory" className={link}>
            Prekių sąrašas
          </NavLink>
          <NavLink to="/barcode" className={link}>
            Barcode
          </NavLink>
          <NavLink to="/movements" className={link}>
            Istorija
          </NavLink>
          <NavLink to="/admin" className={link}>
            Grupės/Tiekėjai
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
