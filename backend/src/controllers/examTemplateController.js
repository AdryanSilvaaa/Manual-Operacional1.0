/**
 * Modelos de prova: cadastro por setor e aplicação a colaboradores específicos ou ao setor inteiro.
 * Gerente de setor só vê, altera e aplica modelos dos seus setores, e só para colaboradores desses setores.
 * Validação em utils/exam.js; SQL em models/ExamTemplate.js. Sem modo demonstração: exige PostgreSQL.
 */
import {
  applyTemplate,
  countSectorCollaborators,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listSectorCollaborators,
  listTemplates,
  updateTemplate
} from '../models/ExamTemplate.js';
import { findSectorById } from '../models/Sector.js';
import { findUnitsByIds } from '../models/Unit.js';
import { audit } from '../models/Audit.js';
import { can, canPublishToUnits, hasSector, PERMISSIONS, seesAllSectors, seesAllUnits } from '../utils/access.js';
import { parseId, validateApplyPayload, validateTemplatePayload } from '../utils/exam.js';


/** O modelo é visível para quem é do setor dele (admin e editor de conteúdo veem todos). */
export function canUseTemplate(user, template) {
  return Boolean(template) && (seesAllSectors(user) || hasSector(user, template.sector_id));
}

/** Carrega o modelo se o usuário pode usá-lo; senão responde 404 e devolve null. */
async function loadTemplate(req, res) {
  const id = parseId(req.params.id);
  const template = id ? await getTemplate(id) : null;
  if (!canUseTemplate(req.user, template)) {
    res.status(404).json({ message: 'Modelo não encontrado ou sem permissão' });
    return null;
  }
  return template;
}

/** Setor do modelo novo: gerente escolhe um dos seus (automático se tiver um só); admin e editor escolhem qualquer setor. */
async function resolveTemplateSector(req) {
  const chosen = parseId(req.body?.sectorId);
  if (seesAllSectors(req.user)) {
    if (!chosen) return { error: 'Escolha o setor do modelo' };
    return (await findSectorById(chosen)) ? { sectorId: chosen } : { error: 'Setor não encontrado' };
  }
  const own = req.user.sector_ids || [];
  if (!own.length) return { error: 'Seu usuário não está vinculado a um setor. Peça ao administrador para definir o setor.' };
  if (!chosen) return own.length === 1 ? { sectorId: Number(own[0]) } : { error: 'Escolha o setor do modelo' };
  return hasSector(req.user, chosen) ? { sectorId: chosen } : { error: 'Você só pode criar modelos para os seus setores' };
}

const auditTemplate = (req, action, template, details = {}) =>
  audit(req.user.id, action, 'exam_template', template.id, { titulo: template.titulo, ...details }).catch(() => {});

export async function index(req, res) {
  res.json(await listTemplates(seesAllSectors(req.user) ? null : req.user.sector_ids || []));
}

export async function show(req, res) {
  const template = await loadTemplate(req, res);
  if (template) res.json(template);
}

export async function store(req, res) {
  const { error, template } = validateTemplatePayload(req.body);
  if (error) return res.status(400).json({ message: error });
  const sector = await resolveTemplateSector(req);
  if (sector.error) return res.status(400).json({ message: sector.error });
  const created = await createTemplate({ ...template, sectorId: sector.sectorId, criadoPor: req.user.id });
  await auditTemplate(req, 'exam_template_created', created);
  res.status(201).json(created);
}

export async function update(req, res) {
  const current = await loadTemplate(req, res);
  if (!current) return;
  const { error, template } = validateTemplatePayload(req.body);
  if (error) return res.status(400).json({ message: error });
  const updated = await updateTemplate(current.id, template);
  await auditTemplate(req, 'exam_template_updated', updated);
  res.json(updated);
}

export async function destroy(req, res) {
  const template = await loadTemplate(req, res);
  if (!template) return;
  await deleteTemplate(template.id);
  await auditTemplate(req, 'exam_template_deleted', template);
  res.status(204).send();
}

// Unidades de quem aplica: nulo para quem vê todas; senão as dele.
const unitScope = (user) => (seesAllUnits(user) ? null : user.unit_ids || []);

// Colaboradores que podem receber a prova deste modelo (os do setor do modelo, nas unidades de quem aplica).
export async function collaborators(req, res) {
  const template = await loadTemplate(req, res);
  if (template) res.json(await listSectorCollaborators(template.sector_id, unitScope(req.user)));
}

/** Aplica o modelo: cria uma prova nova com cópia das perguntas para os colaboradores escolhidos ou o setor todo. */
export async function apply(req, res) {
  const template = await loadTemplate(req, res);
  if (!template) return;
  const { error, application } = validateApplyPayload(req.body);
  if (error) return res.status(400).json({ message: error });
  if (!template.questions.length) return res.status(400).json({ message: 'O modelo não tem perguntas' });
  if (application.audience === 'todos' && !can(req.user, PERMISSIONS.APPLY_EXAM_ALL_SECTORS)) {
    return res.status(403).json({ message: 'Só o perfil admin pode aplicar a prova para todos os setores' });
  }
  if (application.userIds.length) {
    const valid = await countSectorCollaborators(template.sector_id, application.userIds, unitScope(req.user));
    if (valid !== application.userIds.length) {
      return res.status(400).json({ message: `Escolha apenas colaboradores do setor ${template.sector_name} nas suas unidades` });
    }
  }
  // Unidade da prova (setor inteiro): vazia = todas as unidades. Escolhida, precisa existir e ser de quem aplica.
  const unitId = application.userIds.length ? null : Number(req.body?.unitId) || null;
  if (unitId) {
    if ((await findUnitsByIds([unitId])).length !== 1) return res.status(400).json({ message: 'Unidade não encontrada' });
    if (!canPublishToUnits(req.user, [unitId])) return res.status(403).json({ message: 'Você só pode aplicar provas nas suas unidades' });
  }
  const exam = await applyTemplate(template, { ...application, unitId, criadoPor: req.user.id });
  await auditTemplate(req, 'exam_template_applied', template, { examId: exam.id, audience: application.audience, userIds: application.userIds, unitId });
  res.status(201).json(exam);
}
