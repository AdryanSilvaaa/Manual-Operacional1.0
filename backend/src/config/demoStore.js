/**
 * Banco temporário em memória para desenvolvimento quando o PostgreSQL está ausente.
 * Alterar dados, contadores ou métodos aqui muda somente o modo de demonstração.
 */
import { hasSector, isSupport } from '../utils/access.js';

const ADMIN_PASSWORD_HASH = '$2a$10$aEV41I/MA/qN00fWXu5UCuO/kPA0KT.DG5Br/zho02MdrowLgDIeC';

let nextUserId = 2;
let nextSystemId = 1;
let nextManualId = 1;
let nextSectorId = 2;
let nextExamId = 1;
let nextExamQuestionId = 1;
let nextSubmissionId = 1;

const sectors = [{ id: 1, nome: 'Geral' }];
const users = [{
  id: 1,
  nome: 'Suporte Admin',
  email: 'admin@manual.local',
  identificador: 'admin',
  senha: ADMIN_PASSWORD_HASH,
  role: 'suporte',
  sector_ids: [],
  created_at: new Date().toISOString()
}];
const systems = [];
const manuals = [];
const progressEntries = [];
const exams = [];
const examQuestions = [];
const examSubmissions = [];
const examAnswers = [];

export function demoEnabled() {
  return process.env.DEV_DEMO_MODE === 'true';
}

export function isDatabaseUnavailable(error) {
  return ['28P01', 'ECONNREFUSED', '3D000'].includes(error?.code);
}

/** Decide se a requisição deve usar a memória quando o PostgreSQL não existe localmente. */
export function shouldUseDemoStore(error) {
  return demoEnabled() && isDatabaseUnavailable(error);
}

/** Remove a senha e inclui os setores no mesmo formato do PostgreSQL (sector_ids e setores). */
function toSafeUser(user) {
  if (!user) return null;
  const { senha, ...safeUser } = user;
  const setores = user.sector_ids
    .map((id) => sectors.find((sector) => sector.id === id))
    .filter(Boolean)
    .sort((left, right) => left.nome.localeCompare(right.nome));
  return { ...safeUser, sector_ids: setores.map((sector) => sector.id), setores };
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

  findSectorsByIds(ids) {
    return sectors.filter((sector) => ids.map(Number).includes(sector.id)).sort((left, right) => left.nome.localeCompare(right.nome));
  },

  listUsers() {
    return users.map(toSafeUser).sort((left, right) => left.nome.localeCompare(right.nome));
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

  createUser({ nome, identificador, senhaHash, role, sectorIds }) {
    const user = { id: nextUserId++, nome, identificador, senha: senhaHash, role, sector_ids: sectorIds.map(Number), created_at: new Date().toISOString() };
    users.push(user);
    return toSafeUser(user);
  },

  updateUser(id, data) {
    const user = users.find((item) => Number(item.id) === Number(id));
    if (!user) return null;
    Object.assign(user, { nome: data.nome, identificador: data.identificador, role: data.role, sector_ids: data.sectorIds.map(Number) });
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

  // Suporte consulta todos os manuais; os demais perfis leem apenas os ativos dos seus setores.
  listManualsForUser(user, systemId = null) {
    const canReadManual = (manual) => isSupport(user) || (manual.active !== false && hasSector(user, manual.sector_id));
    return manuals
      .filter((manual) => (!systemId || Number(manual.system_id) === Number(systemId)) && canReadManual(manual))
      .map((manual) => {
        const progress = this.getProgress(user.id, manual.id);
        const pdfPercent = progress?.page_count
          ? Math.min(100, (progress.pages_viewed.length / progress.page_count) * 100)
          : 0;
        const videoPercent = Math.min(100, Number(progress?.video_progress) || 0);
        return {
          ...manual,
          first_access_at: progress?.first_access_at || null,
          completed_at: progress?.completed_at || null,
          progress_percent: Math.round((pdfPercent + videoPercent) / 2)
        };
      });
  },

  getManualForUser(id, user) {
    return this.listManualsForUser(user).find((manual) => Number(manual.id) === Number(id));
  },

  createManual({ titulo, descricao, pdfUrl, videoUrl, systemId, sectorId, criadoPor }) {
    const manual = { id: nextManualId++, titulo, descricao, pdf_url: pdfUrl, video_url: videoUrl, system_id: Number(systemId), sector_id: sectorId, criado_por: criadoPor, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    manuals.unshift(manual);
    return manual;
  },

  updateManual(id, data) {
    const manual = manuals.find((item) => Number(item.id) === Number(id));
    if (!manual) return null;
    Object.assign(manual, { titulo: data.titulo ?? manual.titulo, descricao: data.descricao ?? manual.descricao, pdf_url: data.pdfUrl ?? manual.pdf_url, video_url: data.videoUrl ?? manual.video_url, system_id: data.systemId ?? manual.system_id, sector_id: data.sectorId ?? manual.sector_id, updated_at: new Date().toISOString() });
    return manual;
  },

  deleteManual(id) {
    const index = manuals.findIndex((manual) => Number(manual.id) === Number(id));
    if (index >= 0) manuals.splice(index, 1);
  },

  getProgress(userId, manualId) {
    return progressEntries.find((item) => Number(item.user_id) === Number(userId) && Number(item.manual_id) === Number(manualId)) || null;
  },

  saveProgress({ userId, manualId, pdfCompleted, videoProgress, seconds, page, pageCount }) {
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
    if (item.pdf_completed && item.video_progress >= 90 && !item.completed_at) item.completed_at = now;
    return item;
  },

  createExam({ titulo, descricao, sectorId, criadoPor, startsAt, endsAt, questions }) {
    const now = new Date().toISOString();
    const exam = { id: nextExamId++, titulo, descricao, sector_id: sectorId === null ? null : Number(sectorId), criado_por: criadoPor, starts_at: startsAt, ends_at: endsAt, active: true, created_at: now, updated_at: now };
    exams.push(exam);
    questions.forEach((question, position) => examQuestions.push({ id: nextExamQuestionId++, exam_id: exam.id, position, type: question.type, prompt: question.prompt, options: question.options, correct_option: question.correctOption }));
    return { ...exam, question_count: questions.length };
  },

  listAvailableExams(user) {
    const now = new Date();
    return exams
      .filter((exam) => (exam.sector_id === null || hasSector(user, exam.sector_id)) && exam.active && new Date(exam.starts_at) <= now && now <= new Date(exam.ends_at) && !this.hasSubmission(exam.id, user.id))
      .sort((left, right) => new Date(left.ends_at) - new Date(right.ends_at))
      .map(({ id, titulo, descricao, starts_at, ends_at }) => ({ id, titulo, descricao, starts_at, ends_at, question_count: this.listExamQuestions(id).length }));
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
    return examSubmissions.some((item) => Number(item.exam_id) === Number(examId) && Number(item.user_id) === Number(userId));
  },

  createSubmission({ examId, userId, objectiveTotal, objectiveCorrect, answers }) {
    if (this.hasSubmission(examId, userId)) throw Object.assign(new Error('duplicate key'), { code: '23505' });
    const submission = { id: nextSubmissionId++, exam_id: Number(examId), user_id: Number(userId), objective_total: objectiveTotal, objective_correct: objectiveCorrect, submitted_at: new Date().toISOString() };
    examSubmissions.push(submission);
    answers.forEach((answer) => examAnswers.push({ submission_id: submission.id, question_id: answer.questionId, selected_option: answer.selectedOption, answer_text: answer.answerText }));
    return submission;
  },

  listExamResults(user) {
    const managerScope = user.role === 'gerente_setor';
    // Para o gerente, só contam colaboradores que pertencem a um dos setores dele.
    const userInScope = (item) => !managerScope || (item?.sector_ids || []).some((id) => hasSector(user, id));
    const examSectorMatches = (item, exam) => exam.sector_id === null || (item.sector_ids || []).includes(Number(exam.sector_id));
    return exams
      .filter((exam) => exam.sector_id === null || !managerScope || hasSector(user, exam.sector_id))
      .sort((left, right) => new Date(right.starts_at) - new Date(left.starts_at))
      .map((exam) => ({
        ...exam,
        sector_name: exam.sector_id === null ? 'Todos os setores' : this.findSectorById(exam.sector_id)?.nome,
        criado_por_nome: users.find((item) => Number(item.id) === Number(exam.criado_por))?.nome || null,
        collaborators: users.filter((item) => item.role === 'usuario' && examSectorMatches(item, exam) && userInScope(item)).length,
        questions: this.listExamQuestions(exam.id, true).map((question) => ({ ...question, exam_id: exam.id })),
        submissions: examSubmissions
          .filter((submission) => submission.exam_id === exam.id)
          .filter((submission) => userInScope(findRawUser(submission.user_id)))
          .map((submission) => ({
            ...submission,
            user_name: users.find((item) => Number(item.id) === Number(submission.user_id))?.nome,
            answers: examAnswers.filter((answer) => answer.submission_id === submission.id)
          }))
          .sort((left, right) => left.user_name.localeCompare(right.user_name))
      }));
  },

  getProgressReport(user) {
    // Uma linha por operador e manual dos setores dele; gerente de setor vê só os próprios setores.
    const visibleSector = (sectorId) => user.role !== 'gerente_setor' || hasSector(user, sectorId);
    const operators = users.filter((item) => item.role === 'usuario');
    return operators.flatMap((operator) => manuals
      .filter((manual) => operator.sector_ids.includes(Number(manual.sector_id)) && visibleSector(manual.sector_id))
      .map((manual) => ({
        user_id: operator.id, user_name: operator.nome, sector_name: this.findSectorById(manual.sector_id)?.nome,
        manual_id: manual.id, manual_title: manual.titulo,
        pdf_completed: false, video_progress: 0, first_access_at: null,
        last_access_at: null, completed_at: null, total_seconds: 0,
        ...(this.getProgress(operator.id, manual.id) || {})
      })));
  }
};
