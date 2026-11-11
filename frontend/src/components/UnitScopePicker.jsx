/**
 * Escolha das unidades de um conteúdo (manual): "Todas as unidades" ou unidades específicas.
 * value = { unitScope: 'todas' | 'selecionadas', unitIds: [] }. As opções são as unidades que quem publica pode usar
 * (as suas, para o gerente de setor; todas, para admin e editor). Com uma unidade só na empresa, nada é exibido:
 * o conteúdo vale para todas as unidades.
 */
import SectorPicker from './SectorPicker.jsx';

export const ALL_UNITS_SCOPE = { unitScope: 'todas', unitIds: [] };

/** Valor inicial a partir das unidades gravadas no manual (vazia = todas). */
export function unitScopeOf(unitIds = []) {
  return unitIds.length ? { unitScope: 'selecionadas', unitIds: [...unitIds] } : { ...ALL_UNITS_SCOPE };
}

export default function UnitScopePicker({ units, totalUnits, value, onChange, name = 'unit-scope' }) {
  if (totalUnits <= 1) return null;
  const selected = value.unitScope === 'selecionadas';
  return <fieldset>
    <legend>Unidades</legend>
    <div className="exam-mode" role="radiogroup" aria-label="Unidades do manual">
      <label className="quiz-option"><input type="radio" name={name} checked={!selected} onChange={() => onChange({ unitScope: 'todas', unitIds: [] })} /><span><strong>Todas as unidades</strong><br />O manual aparece para os setores marcados em todas as unidades da empresa.</span></label>
      <label className="quiz-option"><input type="radio" name={name} checked={selected} onChange={() => onChange({ unitScope: 'selecionadas', unitIds: value.unitIds.length ? value.unitIds : units.length === 1 ? [units[0].id] : [] })} /><span><strong>Unidades específicas</strong><br />Só quem é dos setores marcados nas unidades escolhidas vê o manual.</span></label>
    </div>
    {selected && (units.length
      ? <SectorPicker sectors={units} value={value.unitIds} onChange={(unitIds) => onChange({ unitScope: 'selecionadas', unitIds })} />
      : <p className="hint">Seu usuário não está vinculado a nenhuma unidade. Peça ao administrador para definir.</p>)}
  </fieldset>;
}

/** Nomes das unidades para tabelas e cartões (lista vazia = todas as unidades). */
export const unitNamesLabel = (names) => (names?.length ? names.join(', ') : 'Todas as unidades');
