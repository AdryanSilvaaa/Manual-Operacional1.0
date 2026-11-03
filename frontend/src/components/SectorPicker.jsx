/**
 * Caixas de seleção de setores (um ou mais), usadas no cadastro de usuários e de manuais.
 * Com allLabel, aparece também o atalho para marcar ou desmarcar todos de uma vez.
 */
export default function SectorPicker({ sectors, value, onChange, allLabel }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  if (!sectors.length) return <p className="hint">Cadastre os setores em Configurações &gt; Setores.</p>;
  const allChecked = sectors.every((sector) => value.includes(sector.id));
  return <div className="sector-picker">
    {allLabel && sectors.length > 1 && <label className="sector-picker-all">
      <input type="checkbox" checked={allChecked} onChange={() => onChange(allChecked ? [] : sectors.map((sector) => sector.id))} />{allLabel}
    </label>}
    {sectors.map((sector) => <label key={sector.id}>
      <input type="checkbox" checked={value.includes(sector.id)} onChange={() => toggle(sector.id)} />{sector.nome}
    </label>)}
  </div>;
}
