/**
 * Criação, realização e resultados das provas.
 * Regras de validação e correção ficam em utils/exam.js; SQL em models/Exam.js.
 */
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import {
  createExam,
  findExamById,
  findSubmission,
  finishSubmission,
  listAvailableExams,
  listExamQuestions,
  listExamResults,
  startSubmission
} from '../models/Exam.js';
import { findSectorById } from '../models/Sector.js';
import { SUBMISSION_STATUS, gradeSubmission, isExamOpen, validateExamPayload } from '../utils/exam.js';
import { hasSector, seesAllSectors } from '../utils/access.js';

/** Executa no PostgreSQL e, só no modo demonstração sem banco, usa a memória. */
async function withDemo(databaseCall, demoCall) {
  try {
    return await databaseCall();
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoCall();
  }
}

/**
 * Define o setor da prova: suporte e editor de conteúdo escolhem um setor ou todos (sectorId vazio ou "todos" = null);
 * gerente de setor escolhe um dos seus setores (se tiver só um, ele é usado automaticamente).
 */
async function resolveExamSector(req) {
  if (seesAllSectors(req.user)) {
    const chosen = req.body?.sectorId;
    if (chosen === undefined || chosen === null || chosen === '' || chosen === 'todos') return { sectorId: null };
    const sector = await findSectorById(Number(chosen));
    return sector ? { sectorId: sector.id } : { error: 'Setor não encontrado' };
  }
  const ownSectors = req.user.sector_ids || [];
  if (!ownSectors.length) {
    return { error: 'Seu usuário não está vinculado a um setor. Peça ao suporte para definir o setor antes de criar a prova.' };
  }
  const chosen = req.body?.sectorId;
  if (chosen === undefined || chosen === null || chosen === '' || chosen === 'todos') {
    return ownSectors.length === 1 ? { sectorId: ownSectors[0] } : { error: 'Escolha o setor da prova' };
  }
  return hasSector(req.user, chosen) ? { sectorId: Number(chosen) } : { error: 'Você só pode criar provas para os seus setores' };
}

export async function store(req, res) {
  const { error, exam } = validateExamPayload(req.body);
  if (error) return res.status(400).json({ message: error });
  const sector = await resolveExamSector(req);
  if (sector.error) return res.status(400).json({ message: sector.error });

  const data = { ...exam, sectorId: sector.sectorId, criadoPor: req.user.id };
  const created = await withDemo(() => createExam(data), () => demoStore.createExam(data));
  res.status(201).json(created);
}

// Só colaboradores (perfil usuario) recebem provas para responder.
export async function available(req, res) {
  if (req.user.role !== 'usuario') return res.json([]);
  res.json(await withDemo(() => listAvailableExams(req.user), () => demoStore.listAvailableExams(req.user)));
}

const CLOSED_MESSAGE = 'Esta prova foi encerrada porque você saiu da página antes de enviar.';

/** Encerra a prova com as respostas recebidas (ou nenhuma); as perguntas sem resposta contam como erradas. */
async function closeSubmission(exam, userId, answers) {
  const questions = await withDemo(() => listExamQuestions(exam.id, true), () => demoStore.listExamQuestions(exam.id, true));
  const data = { examId: exam.id, userId, status: SUBMISSION_STATUS.CLOSED, ...gradeSubmission(questions, answers, { partial: true }) };
  try {
    await withDemo(() => finishSubmission(data), () => demoStore.finishSubmission(data));
  } catch (error) {
    if (error?.code !== '23505') throw error;
  }
}

/**
 * Carrega a prova se o colaborador pode respondê-la agora; senão devolve a resposta de erro.
 * Com inProgress (enviar ou sair), a prova precisa estar em andamento. Sem ela (abrir ou iniciar), uma prova
 * que ficou em andamento significa que a pessoa saiu da página sem enviar: ela é encerrada e não abre de novo.
 */
async function loadExamForCollaborator(req, res, { inProgress = false } = {}) {
  const exam = await withDemo(() => findExamById(req.params.id), () => demoStore.findExamById(req.params.id));
  const sameSector = exam?.sector_id === null || hasSector(req.user, exam?.sector_id);
  if (!exam || req.user.role !== 'usuario' || !sameSector) {
    res.status(404).json({ message: 'Prova não encontrada ou sem permissão' });
    return null;
  }
  if (!isExamOpen(exam)) {
    res.status(409).json({ message: 'A prova está fora do período de realização' });
    return null;
  }
  const submission = await withDemo(() => findSubmission(exam.id, req.user.id), () => demoStore.findSubmission(exam.id, req.user.id));
  if (submission?.status === SUBMISSION_STATUS.IN_PROGRESS && inProgress) return exam;
  if (submission?.status === SUBMISSION_STATUS.IN_PROGRESS) {
    await closeSubmission(exam, req.user.id, {});
    res.status(409).json({ message: CLOSED_MESSAGE });
    return null;
  }
  if (submission) {
    res.status(409).json({ message: submission.status === SUBMISSION_STATUS.CLOSED ? CLOSED_MESSAGE : 'Você já entregou esta prova' });
    return null;
  }
  if (inProgress) {
    res.status(409).json({ message: 'Inicie a prova antes de enviar as respostas' });
    return null;
  }
  return exam;
}

// Dados da tela de início; as perguntas só são enviadas depois de iniciar a prova.
export async function show(req, res) {
  const exam = await loadExamForCollaborator(req, res);
  if (!exam) return;
  const questions = await withDemo(() => listExamQuestions(exam.id), () => demoStore.listExamQuestions(exam.id));
  const { id, titulo, descricao, starts_at, ends_at } = exam;
  res.json({ id, titulo, descricao, starts_at, ends_at, question_count: questions.length });
}

// Inicia a prova (uma vez só) e envia as perguntas sem a alternativa correta.
export async function start(req, res) {
  const exam = await loadExamForCollaborator(req, res);
  if (!exam) return;
  const started = await withDemo(() => startSubmission(exam.id, req.user.id), () => demoStore.startSubmission(exam.id, req.user.id));
  if (!started) return res.status(409).json({ message: 'Esta prova já foi iniciada' });
  const questions = await withDemo(() => listExamQuestions(exam.id), () => demoStore.listExamQuestions(exam.id));
  const { id, titulo, descricao, starts_at, ends_at } = exam;
  res.status(201).json({ id, titulo, descricao, starts_at, ends_at, questions });
}

export async function submit(req, res) {
  const exam = await loadExamForCollaborator(req, res, { inProgress: true });
  if (!exam) return;
  const questions = await withDemo(() => listExamQuestions(exam.id, true), () => demoStore.listExamQuestions(exam.id, true));
  const result = gradeSubmission(questions, req.body?.answers || {});
  if (result.error) return res.status(400).json({ message: result.error });

  const data = { examId: exam.id, userId: req.user.id, status: SUBMISSION_STATUS.SENT, ...result };
  try {
    await withDemo(() => finishSubmission(data), () => demoStore.finishSubmission(data));
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ message: 'Você já entregou esta prova' });
    throw error;
  }
  res.status(201).json({ objectiveTotal: result.objectiveTotal, objectiveCorrect: result.objectiveCorrect });
}

// O navegador avisa que a pessoa saiu da página antes de enviar: a prova é encerrada com o que foi respondido.
export async function leave(req, res) {
  const exam = await loadExamForCollaborator(req, res, { inProgress: true });
  if (!exam) return;
  await closeSubmission(exam, req.user.id, req.body?.answers || {});
  res.status(204).send();
}

export async function results(req, res) {
  res.json(await withDemo(() => listExamResults(req.user), () => demoStore.listExamResults(req.user)));
}
