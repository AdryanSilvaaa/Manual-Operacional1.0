/**
 * Campo de pesquisa reutilizado nas listagens de sistemas e manuais.
 * Altere placeholder/label na tela que o utiliza e o visual em styles/components.css.
 */
import { Search, X } from 'lucide-react';

export default function SearchField({ value, onChange, placeholder, label, id = 'catalog-search', suggestions = [] }) {
  const suggestionsId = `${id}-suggestions`;

  return (
    <div className="search-field" role="search">
      <Search size={20} aria-hidden="true" />
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        list={suggestions.length ? suggestionsId : undefined}
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
      {suggestions.length > 0 && (
        <datalist id={suggestionsId}>
          {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
        </datalist>
      )}
    </div>
  );
}
