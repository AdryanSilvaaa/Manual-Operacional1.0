/**
 * Banco temporário em memória para desenvolvimento quando o PostgreSQL está ausente.
 * Alterar dados, contadores ou métodos aqui muda somente o modo de demonstração.
 */
import { can, canManageManual, hasSector, hasUnit, PERMISSIONS, reachesUserUnits, seesAllSectors, seesAllUnits } from '../utils/access.js';
import { isExamOpen } from '../utils/exam.js';

// Hash bcrypt de "admin123": senha do admin de demonstração (o mesmo do usuário inicial do schema.sql).
const ADMIN_PASSWORD_HASH = '$2a$10$aEV41I/MA/qN00fWXu5UCuO/kPA0KT.DG5Br/zho02MdrowLgDIeC';

// Contadores que fazem o papel do SERIAL do PostgreSQL (próximo id de cada "tabela").
let nextUserId = 2;
let nextSystemId = 1;
let nextManualId = 1;
let nextSectorId = 2;
let nextExamId = 1;
let nextExamQuestionId = 1;
let nextSubmissionId = 1;
let nextUnitId = 2;

const sectors = [{ id: 1, nome: 'Geral' }];
// Como a migração do banco: a unidade 'Matriz' já existe.
const units = [{ id: 1, nome: 'Matriz' }];

const unitNames = (ids = []) => ids.map((id) => units.find((unit) => unit.id === Number(id))?.nome).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));

// Mesmo comportamento do índice único do PostgreSQL (idx_users_identificador_unique).
function assertUniqueIdentifier(identificador, ignoreId = null) {
  const taken = users.some((item) => item.identificador === identificador && Number(item.id) !== Number(ignoreId));
  if (taken) throw Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'idx_users_identificador_unique' });
}
const users = [{
  id: 1,
  nome: 'Suporte Admin',
  email: 'admin@manual.local',
  identificador: 'admin',
  senha: ADMIN_PASSWORD_HASH,
  role: 'admin',
  sector_ids: [],
  unit_ids: [],
  created_at: new Date().toISOString()
}];
const systems = [];
const manuals = [];
const progressEntries = [];
const exams = [];
const examQuestions = [];
const examSubmissions = [];
const examAnswers = [];
const settings = new Map();

// Nunca liga em produção: o modo demonstração tem um admin com senha conhecida (admin123) e guarda tudo só na memória.
export function demoEnabled() {
  return process.env.DEV_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
}

export function isDatabaseUnavailable(error) {
  return ['28P01', 'ECONNREFUSED', '3D000'].includes(error?.code);
}

/** Decide se a requisição deve usar a memória quando o PostgreSQL não existe localmente. */
export function shouldUseDemoStore(error) {
  return demoEnabled() && isDatabaseUnavailable(error);
}

/** Remove a senha e inclui setores e unidades no mesmo formato do PostgreSQL (sector_ids, setores, unit_ids, unidades). */
function toSafeUser(user) {
  if (!user) return null;
  const { senha, ...safeUser } = user;
  const setores = user.sector_ids
    .map((id) => sectors.find((sector) => sector.id === id))
    .filter(Boolean)
    .sort((left, right) => left.nome.localeCompare(right.nome));
  const unidades = (user.unit_ids || [])
    .map((id) => units.find((unit) => unit.id === id))
    .filter(Boolean)
    .sort((left, right) => left.nome.localeCompare(right.nome));
  return { ...safeUser, sector_ids: setores.map((sector) => sector.id), setores, unit_ids: unidades.map((unit) => unit.id), unidades };
}

function findRawUser(id) {
  return users.find((user) => Number(user.id) === Number(id));
}

/** Armazenamento em memória exclusivo para desenvolvimento sem banco de dados. */
export const demoStore = {
  findUserByIdentifier(identifier) {
    return users.find((user) => user.identificador === identifier || user.email === identifier);
  },

  findUserById(id) {
    return toSafeUser(findRawUser(id));
  },

  listUserSectorIds(id) {
    return [...(findRawUser(id)?.sector_ids || [])];
  },

  listUserUnitIds(id) {
    return [...(findRawUser(id)?.unit_ids || [])];
  },

  listUnits() {
    return [...units]
      .sort((left, right) => left.nome.localeCompare(right.nome))
      .map((unit) => ({
        ...unit,
        users_count: users.filter((user) => (user.unit_ids || []).includes(unit.id)).length,
        manuals_count: manuals.filter((manual) => (manual.unit_ids || []).includes(unit.id)).length
      }));
  },

  findUnitsByIds(ids) {
    return units.filter((unit) => ids.map(Number).includes(unit.id)).sort((left, right) => left.nome.localeCompare(right.nome));
  },

  // Mesmas regras do banco: nome único sem diferenciar maiúsculas (23505) e exclusão bloqueada em uso (23503).
  createUnit(data) {
    if (units.some((unit) => unit.nome.toLowerCase() === data.nome.toLowerCase())) throw Object.assign(new Error('duplicate key'), { code: '23505' });
    const unit = { ...data, id: nextUnitId++ };
    units.push(unit);
    return unit;
  },

  updateUnit(id, data) {
    const unit = units.find((item) => item.id === Number(id));
    if (!unit) return null;
    if (units.some((item) => item.id !== unit.id && item.nome.toLowerCase() === data.nome.toLowerCase())) throw Object.assign(new Error('duplicate key'), { code: '23505' });
    Object.assign(unit, data);
    return unit;
  },

  deleteUnit(id) {
    const unitId = Number(id);
    const inUse = users.some((user) => (user.unit_ids || []).includes(unitId))
      || manuals.some((manual) => (manual.unit_ids || []).includes(unitId))
      || exams.some((exam) => Number(exam.unit_id) === unitId);
    if (inUse) throw Object.assign(new Error('foreign key'), { code: '23503' });
    const index = units.findIndex((unit) => unit.id === unitId);
    if (index >= 0) units.splice(index, 1);
  },

  findSectorsByIds(ids) {
    return sectors.filter((sector) => ids.map(Number).includes(sector.id)).sort((left, right) => left.nome.localeCompare(right.nome));
  },

  listUsers() {
    return users.map(toSafeUser).sort((left, right) => left.nome.localeCompare(right.nome));
  },

  getSetting(key) {
    return settings.get(key) || null;
  },

  saveSetting(key, value) {
    const setting = { value, updated_at: new Date().toISOString() };
    settings.set(key, setting);
    return setting;
  },

  listSectors() {
    return [...sectors].sort((left, right) => left.nome.localeCompare(right.nome));
  },

  findSectorById(id) {
    return sectors.find((sector) => Number(sector.id) === Number(id));
  },

  // Evita duplicar um setor quando ele já foi informado por nome.
  findOrCreateSector(name) {
    const normalizedName = name.trim();
    let sector = sectors.find((item) => item.nome.toLowerCase() === normalizedName.toLowerCase());

    if (!sector) {
      sector = { id: nextSectorId++, nome: normalizedName };
      sectors.push(sector);
    }

    return sector;
  },

  createUser({ nome, identificador, senhaHash, role, sectorIds, unitIds = [] }) {
    assertUniqueIdentifier(identificador);
    const user = { id: nextUserId++, nome, identificador, senha: senhaHash, role, sector_ids: sectorIds.map(Number), unit_ids: unitIds.map(Number), created_at: new Date().toISOString() };
    users.push(user);
    return toSafeUser(user);
  },

  updateUser(id, data) {
    const user = users.find((item) => Number(item.id) === Number(id));
    if (!user) return null;
    assertUniqueIdentifier(data.identificador, user.id);
    Object.assign(user, { nome: data.nome, identificador: data.identificador, role: data.role, sector_ids: data.sectorIds.map(Number), unit_ids: (data.unitIds ?? user.unit_ids ?? []).map(Number) });
    if (data.senhaHash) user.senha = data.senhaHash;
    return toSafeUser(user);
  },

  deleteUser(id) {
    const index = users.findIndex((user) => Number(user.id) === Number(id));
    if (index >= 0) users.splice(index, 1);
  },

  // Todos os sistemas são exibidos; apenas a contagem segue a permissão do perfil.
  listSystemsForUser(user) {
    return systems.map((system) => ({ ...system, manuals_count: this.listManualsForUser(user).filter((manual) => manual.system_id === system.id).length })).sort((left, right) => left.nome.localeCompare(right.nome));
  },

  createSystem({ nome, resumo }) {
    const system = { id: nextSystemId++, nome, resumo, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    systems.push(system);
    return system;
  },

  updateSystem(id, data) {
    const system = systems.find((item) => Number(item.id) === Number(id));
    if (!system) return null;
    Object.assign(system, { nome: data.nome ?? system.nome, resumo: data.resumo ?? system.resumo, updated_at: new Date().toISOString() });
    return system;
  },

  deleteSystem(id) {
    const index = systems.findIndex((system) => Number(system.id) === Number(id));
    if (index >= 0) systems.splice(index, 1);
    manuals.forEach((manual) => { if (Number(manual.system_id) === Number(id)) manual.system_id = null; });
  },

  // Admin e editor de conteúdo consultam todos os manuais; os demais perfis leem apenas os ativos dos seus setores
  // que sejam das suas unidades ou de todas as unidades.
  listManualsForUser(user, systemId = null) {
    const canReadManual = (manual) => (seesAllSectors(user) && seesAllUnits(user)) || (manual.active !== false
      && (seesAllSectors(user) || manual.sector_ids.some((id) => hasSector(user, id)))
      && reachesUserUnits(user, manual.unit_ids || []));
    return manuals
      .filter((manual) => (!systemId || Number(manual.system_id) === Number(systemId)) && canReadManual(manual))
      .map((manual) => {
        const progress = this.getProgress(user.id, manual.id);
        const pdfPercent = manual.pdf_url && progress?.page_count
          ? Math.min(100, (progress.pages_viewed.length / progress.page_count) * 100)
          : 0;
        const videoPercent = manual.video_url ? Math.min(100, Number(progress?.video_progress) || 0) : 0;
        const parts = Math.max(1, Number(Boolean(manual.pdf_url)) + Number(Boolean(manual.video_url)));
        return {
          ...manual,
          sector_names: manual.sector_ids.map((id) => this.findSectorById(id)?.nome).filter(Boolean),
          unit_ids: manual.unit_ids || [],
          unit_names: unitNames(manual.unit_ids),
          first_access_at: progress?.first_access_at || null,
          completed_at: progress?.completed_at || null,
          progress_percent: Math.round((pdfPercent + videoPercent) / parts),
          ...this.manualExamColumns(manual.id, user.id)
        };
      });
  },

  getManualForUser(id, user) {
    return this.listManualsForUser(user).find((manual) => Number(manual.id) === Number(id));
  },

  // Como no banco: exam_id, exam_required, exam_open e exam_status da prova do manual para o usuário.
  manualExamColumns(manualId, userId) {
    const exam = exams.find((item) => Number(item.manual_id) === Number(manualId));
    if (!exam) return { exam_id: null, exam_required: null, exam_open: null, exam_status: null };
    return { exam_id: exam.id, exam_required: exam.required, exam_open: isExamOpen(exam), exam_status: this.findSubmission(exam.id, userId)?.status || null };
  },

  getManualExamAccess(manualId, user) {
    const manual = manuals.find((item) => Number(item.id) === Number(manualId));
    return {
      hasAccess: Boolean(manual && manual.active !== false && manual.sector_ids.some((id) => hasSector(user, id)) && reachesUserUnits(user, manual.unit_ids || [])),
      completed: Boolean(this.getProgress(user.id, manualId)?.completed_at)
    };
  },

  // Como no banco: sector_ids são todos os setores do manual e sector_id o primeiro escolhido.
  createManual({ titulo, descricao, pdfUrl, videoUrl, systemId, sectorIds, unitIds = [], criadoPor, exam = null }) {
    const manual = { id: nextManualId++, titulo, descricao, pdf_url: pdfUrl, video_url: videoUrl, system_id: Number(systemId), sector_id: sectorIds[0], sector_ids: sectorIds.map(Number), unit_ids: unitIds.map(Number), criado_por: criadoPor, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    manuals.unshift(manual);
    const createdExam = exam ? this.createExam({ ...exam, sectorId: null, manualId: manual.id, criadoPor }) : null;
    return { ...manual, exam_id: createdExam?.id || null, exam_required: createdExam?.required ?? null };
  },

  updateManual(id, data) {
    const manual = manuals.find((item) => Number(item.id) === Number(id));
    if (!manual) return null;
    Object.assign(manual, { titulo: data.titulo ?? manual.titulo, descricao: data.descricao ?? manual.descricao, pdf_url: data.removePdf ? null : data.pdfUrl ?? manual.pdf_url, video_url: data.removeVideo ? null : data.videoUrl ?? manual.video_url, system_id: data.systemId ?? manual.system_id, sector_id: data.sectorIds?.[0] ?? manual.sector_id, sector_ids: data.sectorIds?.map(Number) ?? manual.sector_ids, unit_ids: data.unitIds?.map(Number) ?? manual.unit_ids ?? [], active: data.active ?? manual.active, updated_at: new Date().toISOString() });
    return manual;
  },

  // Mesma regra do banco: gerente de setor só recebe manuais cujos setores são todos seus.
  listManageableManuals(user) {
    return manuals
      .filter((manual) => canManageManual(user, manual.sector_ids, manual.unit_ids || []))
      .map((manual) => ({
        ...manual,
        active: manual.active !== false,
        system_name: systems.find((system) => Number(system.id) === Number(manual.system_id))?.nome || null,
        has_pdf: Boolean(manual.pdf_url),
        has_video: Boolean(manual.video_url),
        sector_names: manual.sector_ids.map((id) => this.findSectorById(id)?.nome).filter(Boolean),
        unit_ids: manual.unit_ids || [],
        unit_names: unitNames(manual.unit_ids)
      }))
      .sort((left, right) => left.titulo.localeCompare(right.titulo));
  },

  getManualSectorIds(id) {
    const manual = manuals.find((item) => Number(item.id) === Number(id));
    return manual ? { id: manual.id, titulo: manual.titulo, pdf_url: manual.pdf_url, video_url: manual.video_url, sector_ids: manual.sector_ids, unit_ids: manual.unit_ids || [] } : null;
  },

  deleteManual(id) {
    const index = manuals.findIndex((manual) => Number(manual.id) === Number(id));
    if (index >= 0) manuals.splice(index, 1);
    // Como o ON DELETE CASCADE de exams.manual_id: a prova do manual sai junto.
    const examIndex = exams.findIndex((exam) => Number(exam.manual_id) === Number(id));
    if (examIndex >= 0) exams.splice(examIndex, 1);
  },

  getProgress(userId, manualId) {
    return progressEntries.find((item) => Number(item.user_id) === Number(userId) && Number(item.manual_id) === Number(manualId)) || null;
  },

  saveProgress({ userId, manualId, pdfCompleted, videoProgress, seconds, page, pageCount, hasPdf = true, hasVideo = true }) {
    let item = this.getProgress(userId, manualId);
    const now = new Date().toISOString();
    if (!item) {
      item = { user_id: Number(userId), manual_id: Number(manualId), pdf_completed: false, video_progress: 0, total_seconds: 0, page_count: 0, last_page: 0, pages_viewed: [], first_access_at: now, last_access_at: now, completed_at: null };
      progressEntries.push(item);
    }
    item.page_count = Math.max(item.page_count, Number(pageCount) || 0);
    item.last_page = Math.max(item.last_page, Number(page) || 0);
    if (page && !item.pages_viewed.includes(Number(page))) item.pages_viewed.push(Number(page));
    item.pdf_completed ||= item.page_count > 0 && item.pages_viewed.length >= item.page_count;
    item.video_progress = Math.max(item.video_progress, Math.min(100, Number(videoProgress) || 0));
    item.total_seconds += Math.max(0, Math.min(60, Number(seconds) || 0));
    item.last_access_at = now;
    if ((!hasPdf || item.pdf_completed) && (!hasVideo || item.video_progress >= 90) && !item.completed_at) item.completed_at = now;
    return item;
  },

  createExam({ titulo, descricao, sectorId = null, unitId = null, criadoPor, startsAt, endsAt, questions, manualId = null, required = false }) {
    const now = new Date().toISOString();
    const exam = { id: nextExamId++, titulo, descricao, sector_id: sectorId === null ? null : Number(sectorId), unit_id: unitId === null ? null : Number(unitId), criado_por: criadoPor, starts_at: startsAt, ends_at: endsAt, manual_id: manualId === null ? null : Number(manualId), required: Boolean(required), active: true, created_at: now, updated_at: now };
    exams.push(exam);
    questions.forEach((question, position) => examQuestions.push({ id: nextExamQuestionId++, exam_id: exam.id, position, type: question.type, prompt: question.prompt, options: question.options, correct_option: question.correctOption }));
    return { ...exam, question_count: questions.length };
  },

  listAvailableExams(user) {
    const now = new Date();
    // Prova de manual: setores do manual e liberada só depois de concluir o manual (igual ao banco).
    const canSee = (exam) => {
      if (!exam.manual_id) return (exam.sector_id === null || hasSector(user, exam.sector_id)) && (!exam.unit_id || hasUnit(user, exam.unit_id));
      const access = this.getManualExamAccess(exam.manual_id, user);
      return access.hasAccess && access.completed;
    };
    const deadline = (exam) => (exam.ends_at ? new Date(exam.ends_at).getTime() : Infinity);
    return exams
      .filter((exam) => canSee(exam) && isExamOpen(exam, now) && !this.hasSubmission(exam.id, user.id))
      .sort((left, right) => Number(right.required) - Number(left.required) || deadline(left) - deadline(right))
      .map(({ id, titulo, descricao, starts_at, ends_at, manual_id, required }) => ({
        id, titulo, descricao, starts_at, ends_at, manual_id, required,
        manual_titulo: manuals.find((manual) => Number(manual.id) === Number(manual_id))?.titulo || null,
        question_count: this.listExamQuestions(id).length
      }));
  },

  findExamById(id) {
    return exams.find((exam) => Number(exam.id) === Number(id)) || null;
  },

  listExamQuestions(examId, includeAnswers = false) {
    return examQuestions
      .filter((question) => Number(question.exam_id) === Number(examId))
      .sort((left, right) => left.position - right.position)
      .map(({ id, position, type, prompt, options, correct_option }) => (includeAnswers ? { id, position, type, prompt, options, correct_option } : { id, position, type, prompt, options }));
  },

  hasSubmission(examId, userId) {
    return Boolean(this.findSubmission(examId, userId));
  },

  findSubmission(examId, userId) {
    return examSubmissions.find((item) => Number(item.exam_id) === Number(examId) && Number(item.user_id) === Number(userId)) || null;
  },

  // Mesmas regras do banco: começa em andamento e termina uma vez só (enviada ou encerrada).
  startSubmission(examId, userId) {
    if (this.hasSubmission(examId, userId)) return null;
    const submission = { id: nextSubmissionId++, exam_id: Number(examId), user_id: Number(userId), objective_total: 0, objective_correct: 0, status: 'em_andamento', started_at: new Date().toISOString(), submitted_at: null };
    examSubmissions.push(submission);
    return submission;
  },

  finishSubmission({ examId, userId, status, objectiveTotal, objectiveCorrect, answers }) {
    let submission = this.findSubmission(examId, userId);
    if (submission && submission.status !== 'em_andamento') throw Object.assign(new Error('duplicate key'), { code: '23505' });
    if (!submission) {
      submission = { id: nextSubmissionId++, exam_id: Number(examId), user_id: Number(userId), started_at: null };
      examSubmissions.push(submission);
    }
    Object.assign(submission, { status, objective_total: objectiveTotal, objective_correct: objectiveCorrect, submitted_at: new Date().toISOString() });
    answers.forEach((answer) => examAnswers.push({ submission_id: submission.id, question_id: answer.questionId, selected_option: answer.selectedOption, answer_text: answer.answerText }));
    return submission;
  },

  listExamResults(user) {
    const managerScope = !seesAllSectors(user);
    const unitScope = !seesAllUnits(user);
    // Para o gerente, só contam colaboradores que pertencem a um dos setores e a uma das unidades dele.
    const userInScope = (item) => (!managerScope || (item?.sector_ids || []).some((id) => hasSector(user, id)))
      && (!unitScope || (item?.unit_ids || []).some((id) => hasUnit(user, id)));
    // Unidades da prova: a avulsa usa exam.unit_id (nulo = todas); a de manual, as do manual (vazia = todas).
    const examUnitIds = (exam) => (exam.manual_id ? manualOf(exam)?.unit_ids || [] : exam.unit_id ? [Number(exam.unit_id)] : []);
    const examReachesPerson = (item, exam) => !examUnitIds(exam).length || examUnitIds(exam).some((id) => (item.unit_ids || []).includes(id));
    // Prova de manual vale para os setores do manual; a avulsa, para exam.sector_id (nulo = todos).
    const manualOf = (exam) => manuals.find((manual) => Number(manual.id) === Number(exam.manual_id));
    const examSectorIds = (exam) => (exam.manual_id ? manualOf(exam)?.sector_ids || [] : exam.sector_id === null ? null : [Number(exam.sector_id)]);
    const examSectorMatches = (item, exam) => {
      const ids = examSectorIds(exam);
      return ids === null || (item.sector_ids || []).some((id) => ids.includes(Number(id)));
    };
    const sectorNames = (exam) => {
      const ids = examSectorIds(exam);
      return ids === null ? ['Todos os setores'] : ids.map((id) => this.findSectorById(id)?.nome).filter(Boolean).sort();
    };
    return exams
      .filter((exam) => {
        const ids = examSectorIds(exam);
        const sectorOk = !managerScope || ids === null || ids.some((id) => hasSector(user, id));
        return sectorOk && (!unitScope || reachesUserUnits(user, examUnitIds(exam)));
      })
      .sort((left, right) => new Date(right.starts_at) - new Date(left.starts_at))
      .map((exam) => ({
        ...exam,
        manual_titulo: manualOf(exam)?.titulo || null,
        sector_names: sectorNames(exam),
        sector_name: sectorNames(exam).join(', '),
        unit_name: examUnitIds(exam).length ? unitNames(examUnitIds(exam)).join(', ') : 'Todas as unidades',
        criado_por_nome: users.find((item) => Number(item.id) === Number(exam.criado_por))?.nome || null,
        collaborators: users.filter((item) => can(item, PERMISSIONS.TAKE_EXAMS) && examSectorMatches(item, exam) && examReachesPerson(item, exam) && userInScope(item)).length,
        questions: this.listExamQuestions(exam.id, true).map((question) => ({ ...question, exam_id: exam.id })),
        submissions: examSubmissions
          .filter((submission) => submission.exam_id === exam.id)
          .filter((submission) => userInScope(findRawUser(submission.user_id)))
          .map((submission) => ({
            ...submission,
            status: submission.status === 'em_andamento' && exam.ends_at && new Date() > new Date(exam.ends_at) ? 'encerrada' : submission.status,
            user_name: users.find((item) => Number(item.id) === Number(submission.user_id))?.nome,
            answers: examAnswers.filter((answer) => answer.submission_id === submission.id)
          }))
          .sort((left, right) => left.user_name.localeCompare(right.user_name))
      }));
  },

  getProgressReport(user) {
    // Mesma regra do banco: qualquer perfil, manuais dos setores da pessoa mais os que ela abriu;
    // gerente de setor vê só quem é dos próprios setores, nos manuais desses setores.
    const managerScope = !seesAllSectors(user);
    const unitScope = !seesAllUnits(user);
    // A pessoa recebe o manual se ele for da unidade dela (ou de todas); fora das unidades do gerente, não aparece.
    const manualReachesPerson = (person, manual) => !(manual.unit_ids || []).length || manual.unit_ids.some((id) => (person.unit_ids || []).includes(id));
    const inUnitScope = (person, manual) => !unitScope || ((person.unit_ids || []).some((id) => hasUnit(user, id)) && reachesUserUnits(user, manual.unit_ids || []));
    // Setores do manual pelos quais a pessoa o recebe (no escopo do gerente, quando for o caso).
    const sharedSectors = (person, manual) => (manualReachesPerson(person, manual) ? manual.sector_ids : [])
      .filter((id) => (person.sector_ids || []).includes(Number(id)) && (!managerScope || hasSector(user, id)));
    const opened = (person, manual) => Boolean(this.getProgress(person.id, manual.id));
    const sectorNames = (ids) => ids.map((id) => this.findSectorById(id)?.nome).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return users.flatMap((operator) => manuals
      .filter((manual) => inUnitScope(operator, manual) && (managerScope ? sharedSectors(operator, manual).length > 0
        : sharedSectors(operator, manual).length > 0 || opened(operator, manual)))
      .map((manual) => {
        const shared = sharedSectors(operator, manual);
        const names = sectorNames(shared.length ? shared : manual.sector_ids);
        return {
          user_id: operator.id, user_name: operator.nome, user_role: operator.role, sector_names: names, sector_name: names.join(', '),
          unit_names: unitNames(operator.unit_ids),
          manual_id: manual.id, manual_title: manual.titulo,
          pdf_completed: false, video_progress: 0, first_access_at: null,
          last_access_at: null, completed_at: null, total_seconds: 0,
          ...(this.getProgress(operator.id, manual.id) || {})
        };
      }));
  }
};
