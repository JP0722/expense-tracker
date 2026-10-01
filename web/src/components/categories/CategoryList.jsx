import { Spinner } from "../ui/Spinner.jsx";
import { Tags, Pencil, Trash2, Plus } from "lucide-react";

export function CategoryList({ categories, loading, onAdd, onEdit, onDelete }) {
  return (
    <>
      <section className="section-heading">
        <div>
          <h2>
            Your categories{" "}
            <span className="count-pill">{categories.length}</span>
          </h2>
          <p>Start with the defaults. Add your own as life happens.</p>
        </div>
      </section>
      {loading && !categories.length ? (
        <div className="loading-panel">
          <Spinner />
          Loading categories…
        </div>
      ) : (
        <div className="category-grid">
          {categories.map((c) => (
            <article className="category-card" key={c.id}>
              <div className="category-card-top">
                <span
                  className="category-symbol"
                  style={{ background: `${c.color}20`, color: c.color }}
                >
                  <Tags size={23} />
                </span>
                <span className="category-type">
                  {c.isDefault ? "DEFAULT" : "PERSONAL"}
                </span>
              </div>
              <h3>{c.name}</h3>
              <p>
                {c.count} {c.count === 1 ? "expense" : "expenses"}
              </p>
              <div className="category-card-actions">
                <button onClick={() => onEdit(c)}>
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  aria-label={`Delete ${c.name}`}
                  onClick={() => onDelete(c)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
          <button className="new-category-card" onClick={onAdd}>
            <Plus size={26} />
            <strong>Something else?</strong>
            <span>Create your own category</span>
          </button>
        </div>
      )}
    </>
  );
}
