/**
 * Orquestra o CRUD dos sistemas que agrupam os manuais.
 * Altere validações HTTP aqui e consultas/efeitos de exclusão em models/System.js.
 */
import {
  createSystem,
  deleteSystem,
  listSystemsForUser,
  updateSystem
} from '../models/System.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { audit } from '../models/Audit.js';

// Tamanho máximo do nome (systems.nome VARCHAR(160) no schema.sql).
const MAX_NAME_LENGTH = 160;

/** Nome e resumo vindos da tela: só texto, sem espaços nas pontas. undefined = campo não enviado. */
const cleanField = (value) => (value === undefined ? undefined : typeof value === 'string' ? value.trim() : '');

/** Lista todos os sistemas com a quantidade de manuais que o usuário pode ver em cada um. */
export async function index(req, res) {
  let systems;
  try {
    systems = await listSystemsForUser(req.user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    systems = demoStore.listSystemsForUser(req.user);
  }

  res.json(systems);
}

/** Cadastra um sistema (vale para todos os setores). */
export async function store(req, res) {
  const nome = cleanField(req.body.nome) || '';
  const resumo = cleanField(req.body.resumo) || null;

  if (!nome) {
    return res.status(400).json({ message: 'Nome do sistema e obrigatorio' });
  }
  if (nome.length > MAX_NAME_LENGTH) return res.status(400).json({ message: `O nome pode ter até ${MAX_NAME_LENGTH} caracteres` });

  let system;
  try {
    system = await createSystem({ nome, resumo });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    system = demoStore.createSystem({ nome, resumo });
  }

  audit(req.user.id, 'system_created', 'system', system.id, { nome }).catch(() => {});
  res.status(201).json(system);
}

/** Renomeia ou troca o resumo; os manuais continuam ligados ao mesmo sistema. */
export async function update(req, res) {
  const nome = cleanField(req.body.nome);
  const resumo = cleanField(req.body.resumo);

  if (nome !== undefined && !nome) {
    return res.status(400).json({ message: 'Nome do sistema e obrigatorio' });
  }
  if (nome && nome.length > MAX_NAME_LENGTH) return res.status(400).json({ message: `O nome pode ter até ${MAX_NAME_LENGTH} caracteres` });

  let system;
  try {
    system = await updateSystem(req.params.id, { nome, resumo });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    system = demoStore.updateSystem(req.params.id, { nome, resumo });
  }

  if (!system) {
    return res.status(404).json({ message: 'Sistema nao encontrado' });
  }

  res.json(system);
}

/** Exclui o sistema; o banco recusa (23503) se ainda houver manuais nele. */
export async function destroy(req, res) {
  try {
    await deleteSystem(req.params.id);
  } catch (error) {
    if (error?.code === '23503') {
      return res.status(409).json({ message: 'Nao e possivel excluir um sistema que possui manuais vinculados' });
    }
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    demoStore.deleteSystem(req.params.id);
  }

  audit(req.user.id, 'system_deleted', 'system', req.params.id).catch(() => {});
  res.status(204).send();
}
