export function ExpenseDraftCard({
  draft,
  index,
  categories,
  onChange,
  onRemove,
  disabled,
}) {
  function field(name) {
    return {
      value: draft[name] ?? "",
      onChange: (event) => onChange(name, event.target.value),
    };
  }
  return (
    <fieldset className="expense-draft" disabled={disabled}>
      <legend>Expense {index + 1}</legend>
      <label>
        Description
        <input {...field("title")} maxLength={120} required />
      </label>
      <div className="form-grid">
        <label>
          Amount (INR)
          <input
            {...field("amount")}
            type="number"
            inputMode="decimal"
            min="0.01"
            max="999999999.99"
            step="0.01"
            required
          />
        </label>
        <label>
          Expense date
          <input
            {...field("date")}
            type="date"
            min="1900-01-01"
            max="9999-12-31"
            required
          />
        </label>
      </div>
      <label>
        Category
        <select {...field("categoryId")} required>
          <option value="">Choose a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Notes <span className="optional">optional</span>
        <textarea {...field("notes")} maxLength={500} rows={2} />
      </label>
      <button className="button secondary" type="button" onClick={onRemove}>
        Remove expense {index + 1}
      </button>
    </fieldset>
  );
}
