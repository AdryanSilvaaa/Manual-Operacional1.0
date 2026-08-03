/**
 * Campo de pesquisa reutilizado nas listagens de sistemas e manuais.
 * Altere placeholder/label na tela que o utiliza e o visual em styles/components.css.
 */
import { Search, X } from 'lucide-react';

export default function SearchField({ value, onChange, placeholder, label }) {
  return (
    <div className="search-field" role="search">
      <Search size={20} aria-hidden="true" />
      <label className="sr-only" htmlFor="catalog-search">{label}</label>
      <input
        id="catalog-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          onClick={() => onChange('')}
          aria-label="Limpar pesquisa"
          title="Limpar pesquisa"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
