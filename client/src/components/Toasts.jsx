export default function Toasts({ items = [], onClose }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl shadow-lg px-4 py-3 border text-sm
            ${
              t.kind === "success"
                ? "bg-green-600 text-white border-green-700"
                : t.kind === "error"
                ? "bg-red-600 text-white border-red-700"
                : "bg-gray-900 text-white border-gray-800"
            }`}
        >
          <div className="flex items-start gap-3">
            <div className="font-medium">
              {t.title || (t.kind === "success" ? "Sėkmė" : "Pranešimas")}
            </div>
            <button
              onClick={() => onClose?.(t.id)}
              className="ml-auto opacity-80 hover:opacity-100"
            >
              ×
            </button>
          </div>
          {t.text ? <div className="mt-1 opacity-90">{t.text}</div> : null}
        </div>
      ))}
    </div>
  );
}
