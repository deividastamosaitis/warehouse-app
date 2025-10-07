export default function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Pasirinkti...",
  disabled,
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-600">{label}</span>
      <select
        disabled={disabled}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border rounded-xl p-2"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o._id} value={o._id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
