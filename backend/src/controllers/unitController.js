/**
 * Cadastro de unidades (filiais) com endereço completo. Quem tem a permissão de cadastrar unidades cria, altera
 * e exclui; a lista é lida pelas telas de usuários, manuais, provas e painel.
 */
import { createUnit, deleteUnit, listUnits, updateUnit } from '../models/Unit.js';
import { audit } from '../models/Audit.js';

const DUPLICATE_MESSAGE = 'Já existe uma unidade com esse nome';

function cleanName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

// Tamanho máximo de cada campo de texto (mesmo das colunas em schema.sql) e o nome exibido no erro.
const TEXT_FIELDS = {
  logradouro: [160, 'O logradouro'], numero: [20, 'O número'], complemento: [80, 'O complemento'],
  bairro: [80, 'O bairro'], cidade: [80, 'A cidade']
};

/**
 * Valida nome e endereço. Todos os campos de endereço são opcionais: vazio vira null.
 * CEP aceita com ou sem traço e é gravado só com os 8 dígitos; UF precisa ser uma sigla válida.
 */
function parseUnit(body = {}) {
  const nome = cleanName(body.nome);
  if (!nome) return { error: 'Nome da unidade é obrigatório' };
  if (nome.length > 120) return { error: 'O nome da unidade pode ter até 120 caracteres' };
  const data = { nome };
  for (const [field, [max, label]] of Object.entries(TEXT_FIELDS)) {
    const value = cleanName(body[field]);
    if (value.length > max) return { error: `${label} pode ter até ${max} caracteres` };
    data[field] = value || null;
  }
  const cep = String(body.cep ?? '').replace(/\D/g, '');
  if (cep && cep.length !== 8) return { error: 'CEP inválido: informe os 8 números' };
  data.cep = cep || null;
  const uf = cleanName(body.uf).toUpperCase();
  if (uf && !UFS.includes(uf)) return { error: 'UF inválida' };
  data.uf = uf || null;
  return { data };
}

const auditUnit = (req, action, unit) => audit(req.user.id, action, 'unit', unit.id, { nome: unit.nome }).catch(() => {});

export async function index(req, res) {
  res.json(await listUnits());
}

export async function store(req, res) {
  const { error, data } = parseUnit(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    const unit = await createUnit(data);
    await auditUnit(req, 'unit_created', unit);
    res.status(201).json(unit);
  } catch (err) {
    if (err?.code === '23505') return res.status(409).json({ message: DUPLICATE_MESSAGE });
    throw err;
  }
}

export async function update(req, res) {
  const id = Number(req.params.id);
  const { error, data } = parseUnit(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    const unit = Number.isInteger(id) && id > 0 ? await updateUnit(id, data) : null;
    if (!unit) return res.status(404).json({ message: 'Unidade não encontrada' });
    await auditUnit(req, 'unit_updated', unit);
    res.json(unit);
  } catch (err) {
    if (err?.code === '23505') return res.status(409).json({ message: DUPLICATE_MESSAGE });
    throw err;
  }
}

// Unidade com usuários, manuais ou provas não é excluída: tire os vínculos antes (o banco garante com ON DELETE RESTRICT).
export async function destroy(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ message: 'Unidade não encontrada' });
  try {
    await deleteUnit(id);
  } catch (err) {
    if (err?.code === '23503') {
      return res.status(409).json({ message: 'A unidade ainda tem usuários, manuais ou provas. Retire esses vínculos antes de excluir.' });
    }
    throw err;
  }
  await audit(req.user.id, 'unit_deleted', 'unit', id).catch(() => {});
  res.status(204).send();
}
