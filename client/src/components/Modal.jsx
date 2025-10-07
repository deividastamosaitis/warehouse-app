export default function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="space-y-3">{children}</div>
        <div className="mt-6 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
