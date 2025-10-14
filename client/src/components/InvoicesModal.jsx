import { useEffect, useState } from "react";
import { fetchProductInvoices } from "../api";

export default function InvoicesModal({ product, open, onClose }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (open && product?._id) {
      fetchProductInvoices(product._id, 10)
        .then(setItems)
        .catch(() => setItems([]));
    }
  }, [open, product?._id]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-4 w-full max-w-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Sąskaitos – {product?.name}</h3>
          <button onClick={onClose} className="text-xl">
            &times;
          </button>
        </div>
        {items.length === 0 ? (
          <div className="text-gray-600">Nerasta sąskaitų (IN judėjimų).</div>
        ) : (
          <div className="divide-y">
            {items.map((r, i) => (
              <div key={i} className="py-2 text-sm flex justify-between">
                <div>
                  <div className="font-medium">{r.invoiceNumber}</div>
                  <div className="text-gray-500">
                    Pask. kartas: {new Date(r.last).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-600">
                    Kiekis: <b>{r.totalQty}</b>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-200"
          >
            Uždaryti
          </button>
        </div>
      </div>
    </div>
  );
}
