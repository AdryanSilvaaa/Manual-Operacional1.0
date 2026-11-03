/**
 * Campo de escolha com pesquisa: ao clicar abre a lista de opções e o texto digitado filtra a lista.
 * Opções podem ser textos ou objetos { value, label }. Com `locked` o campo fica travado no valor atual.
 * Usa o mesmo visual do SearchField (styles/components.css); a lista suspensa fica em styles/pages.css.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Lock, Search, X } from 'lucide-react';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function toItem(option) {
  return typeof option === 'object' ? { value: String(option.value), label: option.label } : { value: option, label: option };
}

export default function SearchSelect({ id, value, onChange, options, placeholder, label, allLabel = 'Todos', emptyText = 'Nenhum resultado encontrado', locked = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);
  const listId = `${id}-options`;
  const allItems = options.map(toItem);
  const selected = allItems.find((item) => item.value === String(value ?? ''));
  // A primeira opção (valor vazio) remove o filtro.
  const items = [{ value: '', label: allLabel }, ...allItems]
    .filter((item) => !query || (item.value && normalize(item.label).includes(normalize(query))));

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => { if (!containerRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  if (locked) {
    return <div className="search-select locked">
      <div className="search-field" title="Você só tem acesso a este setor">
        <Lock size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor={id}>{label}</label>
        <input id={id} value={selected?.label || value || ''} readOnly disabled />
      </div>
    </div>;
  }

  function openList() { setOpen(true); setQuery(''); setHighlight(0); }

  function choose(item) {
    onChange(item.value);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); if (!open) openList(); else setHighlight((current) => Math.min(current + 1, items.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((current) => Math.max(current - 1, 0)); }
    if (event.key === 'Enter' && open && items[highlight]) { event.preventDefault(); choose(items[highlight]); }
    if (event.key === 'Escape') setOpen(false);
  }

  return <div className="search-select" ref={containerRef}>
    <div className="search-field" onClick={() => !open && openList()}>
      <Search size={20} aria-hidden="true" />
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={open ? query : (selected?.label || allLabel)}
        placeholder={placeholder}
        onFocus={() => !open && openList()}
        onChange={(event) => { setQuery(event.target.value); setHighlight(0); setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {value
        ? <button type="button" className="search-clear" onClick={(event) => { event.stopPropagation(); choose({ value: '' }); }} aria-label="Limpar escolha" title="Limpar"><X size={18} aria-hidden="true" /></button>
        : <ChevronDown size={18} aria-hidden="true" className="search-select-arrow" />}
    </div>
    {open && <ul className="search-select-list" id={listId} role="listbox">
      {items.length ? items.map((item, index) => <li
        key={item.value || '__todos'}
        role="option"
        aria-selected={item.value === String(value ?? '')}
        className={index === highlight ? 'highlighted' : undefined}
        onMouseEnter={() => setHighlight(index)}
        onMouseDown={(event) => { event.preventDefault(); choose(item); }}
      >{item.label}</li>) : <li className="search-select-empty">{emptyText}</li>}
    </ul>}
  </div>;
}
