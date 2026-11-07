import bcrypt from 'bcryptjs';
import { config } from '../config';
import type { ProposedArticle } from '../shared/content';
import { articlesRepository, type NewVersionRow } from '../modules/articles/articles.repository';
import type { DecisionKind } from '../modules/audit/audit.model';
import { auditRepository } from '../modules/audit/audit.repository';
import { categoriesRepository } from '../modules/categories/categories.repository';
import { commentsRepository } from '../modules/comments/comments.repository';
import type { CommunityResult, DecisionOutcome, ProposalStatus } from '../modules/proposals/proposals.model';
import { proposalsRepository } from '../modules/proposals/proposals.repository';
import { REPUTATION_DELTA } from '../modules/reputation/reputation.model';
import { voteWeight } from '../modules/reputation/reputation.policy';
import { reputationRepository } from '../modules/reputation/reputation.repository';
import type { Role } from '../modules/users/users.model';
import { usersRepository } from '../modules/users/users.repository';
import type { VoteChoice } from '../modules/votes/votes.model';
import { votesRepository } from '../modules/votes/votes.repository';
import { inTransaction } from './connection';

/** Fecha fija de la semilla, para que cada recreación dé el mismo resultado. */
const at = (day: string, time = '10:00'): string => `2026-${day}T${time}:00.000Z`;

interface SeedUser {
  id: string;
  username: string;
  alias: string;
  role: Role;
  initialReputation: number;
}

const USERS: readonly SeedUser[] = [
  { id: 'u-lucia', username: 'lucia', alias: 'Lucía', role: 'admin', initialReputation: 50 },
  { id: 'u-tomas', username: 'tomas', alias: 'Tomás', role: 'moderador', initialReputation: 30 },
  { id: 'u-sofia', username: 'sofia', alias: 'Sofía', role: 'moderador', initialReputation: 30 },
  { id: 'u-raul', username: 'raul', alias: 'Raúl', role: 'moderador', initialReputation: 10 },
  // Cuarto moderador: con pesos 3, 3 y 1 el total es impar y no puede haber empate.
  { id: 'u-diego', username: 'diego', alias: 'Diego', role: 'moderador', initialReputation: 10 },
  { id: 'u-ana', username: 'ana', alias: 'Ana', role: 'cliente', initialReputation: 10 },
  { id: 'u-martin', username: 'martin', alias: 'Martín', role: 'cliente', initialReputation: 10 },
];

const ADMIN_ID = 'u-lucia';

const CATEGORIES = [
  { id: 'c-operacion', name: 'Operación', description: 'Procedimientos del día a día', parentId: null },
  { id: 'c-turnos', name: 'Turnos', description: 'Apertura, cambio y cierre de turnos', parentId: 'c-operacion' },
  { id: 'c-caja', name: 'Caja', description: 'Manejo de efectivo y arqueos', parentId: 'c-operacion' },
  { id: 'c-seguridad', name: 'Seguridad', description: 'Accesos, alarmas y resguardo', parentId: null },
] as const;

const TESORERIA = { title: 'Manual de tesorería interno', url: 'https://intranet.example.com/tesoreria' };

const APERTURA_V1: ProposedArticle = {
  title: 'Apertura de caja',
  summary: 'Pasos para abrir la caja al inicio del turno.',
  categoryId: 'c-caja',
  tags: ['caja', 'apertura'],
  sources: [TESORERIA],
  content: `# Apertura de caja

Procedimiento para abrir la caja al inicio del turno.

## Pasos

- Contar el fondo fijo.
- Registrar el monto inicial en el sistema.
`,
};

const APERTURA_V2: ProposedArticle = {
  ...APERTURA_V1,
  summary: 'Pasos para abrir la caja al inicio del turno, con control de la persona supervisora.',
  content: `# Apertura de caja

Procedimiento para abrir la caja al inicio del turno.

## Antes de abrir

- Verificar que el fondo fijo esté completo.
- Confirmar que la persona supervisora esté presente.

## Al abrir

- Contar billetes y monedas frente a la persona supervisora.
- Registrar el monto inicial en el sistema.
- Firmar la planilla de apertura.
`,
};

const CAMBIO_TURNO_V1: ProposedArticle = {
  title: 'Cambio de turno',
  summary: 'Entrega de puesto entre el turno saliente y el entrante.',
  categoryId: 'c-turnos',
  tags: ['turnos'],
  sources: [],
  content: `# Cambio de turno

El turno saliente entrega el puesto al entrante.

## Entrega

- Informar novedades del turno.
- Entregar llaves y credenciales.
`,
};

const CAMBIO_TURNO_V2: ProposedArticle = {
  ...CAMBIO_TURNO_V1,
  summary: 'Entrega de puesto entre turnos, con registro escrito de novedades.',
  content: `# Cambio de turno

El turno saliente entrega el puesto al entrante.

## Entrega

- Registrar las novedades en el libro de turno.
- Informar novedades del turno en voz alta.
- Entregar llaves y credenciales, y firmar la entrega.
`,
};

const ACCESO_DEPOSITO_V1: ProposedArticle = {
  title: 'Acceso al depósito',
  summary: 'Quién puede entrar al depósito y cómo se registra el ingreso.',
  categoryId: 'c-seguridad',
  tags: ['seguridad', 'depósito'],
  sources: [],
  content: `# Acceso al depósito

Solo entra personal autorizado.

## Registro

- Anotar nombre, hora de ingreso y hora de salida.
- Cerrar con llave al salir.
`,
};

interface SeedVote {
  moderatorId: string;
  choice: VoteChoice;
  day: string;
}

interface SeedDecision {
  outcome: DecisionOutcome;
  kind: DecisionKind;
  reason: string | null;
  day: string;
}

interface SeedProposal {
  id: string;
  authorId: string;
  articleId: string | null;
  baseVersionId: string | null;
  proposed: ProposedArticle;
  createdDay: string;
  votingOpenedDay?: string;
  votes?: readonly SeedVote[];
  closed?: { result: CommunityResult; day: string };
  decision?: SeedDecision;
  /** Versión que nace al aceptar (id fijo para la semilla). */
  publishedVersionId?: string;
  status: ProposalStatus;
}

function seedUsers(): void {
  const passwordHash = bcrypt.hashSync(config.defaultPassword, 10);
  for (const user of USERS) {
    const createdAt = at('10-01', '09:00');
    usersRepository.insert({ ...user, passwordHash, createdAt });
    reputationRepository.insert({
      id: `rep-inicial-${user.username}`,
      userId: user.id,
      eventType: 'asignacion_inicial',
      sourceId: user.id,
      delta: user.initialReputation,
      createdAt,
    });
    if (user.id !== ADMIN_ID) {
      auditRepository.insert({
        id: `aud-alta-${user.username}`,
        actorId: ADMIN_ID,
        action: 'alta_usuario',
        entityType: 'user',
        entityId: user.id,
        reason: null,
        decisionKind: null,
        createdAt,
      });
    }
  }
}

function seedCategories(): void {
  for (const category of CATEGORIES) {
    categoriesRepository.insert({ ...category, createdAt: at('10-02') });
  }
}

function publishVersion(version: NewVersionRow, createdBy?: string): void {
  if (version.versionNumber === 1) {
    articlesRepository.insertArticle({
      id: version.articleId,
      title: version.title,
      summary: version.summary,
      categoryId: version.categoryId,
      createdBy: createdBy ?? version.publishedBy,
      createdAt: version.publishedAt,
    });
  }
  articlesRepository.insertVersion(version);
  articlesRepository.setCurrentVersion(version);
}

function firstVersion(articleId: string, versionId: string, content: ProposedArticle, day: string): NewVersionRow {
  return {
    id: versionId,
    articleId,
    versionNumber: 1,
    ...content,
    changeSummary: 'Versión inicial',
    publishedBy: ADMIN_ID,
    publishedAt: at(day),
    proposalId: null,
  };
}

function seedProposal(seed: SeedProposal): void {
  proposalsRepository.insert({
    id: seed.id,
    kind: seed.articleId === null ? 'creacion' : 'modificacion',
    articleId: seed.articleId,
    baseVersionId: seed.baseVersionId,
    authorId: seed.authorId,
    proposed: seed.proposed,
    status: 'abierta',
    createdAt: at(seed.createdDay),
  });

  if (seed.votingOpenedDay) {
    proposalsRepository.openVoting(seed.id, at(seed.votingOpenedDay));
  }

  for (const vote of seed.votes ?? []) {
    const moderator = USERS.find((user) => user.id === vote.moderatorId);
    if (!moderator) throw new Error(`Moderador desconocido en la semilla: ${vote.moderatorId}`);
    votesRepository.insert({
      id: `vote-${seed.id}-${moderator.username}`,
      proposalId: seed.id,
      moderatorId: moderator.id,
      choice: vote.choice,
      weightAtVote: voteWeight(moderator.initialReputation),
      createdAt: at(vote.day),
    });
  }

  if (seed.closed) {
    proposalsRepository.closeVoting(seed.id, seed.closed.result, at(seed.closed.day));
  }

  if (seed.decision) {
    const decidedAt = at(seed.decision.day);
    let publishedArticleId: string | null = null;

    if (seed.decision.outcome === 'aceptar' && seed.articleId && seed.publishedVersionId) {
      publishVersion({
        id: seed.publishedVersionId,
        articleId: seed.articleId,
        versionNumber: articlesRepository.nextVersionNumber(seed.articleId),
        ...seed.proposed,
        changeSummary: `Propuesta aceptada: ${seed.proposed.title}`,
        publishedBy: seed.authorId,
        publishedAt: decidedAt,
        proposalId: seed.id,
      });
      publishedArticleId = seed.articleId;
      reputationRepository.insert({
        id: `rep-aporte-${seed.id}`,
        userId: seed.authorId,
        eventType: 'aporte_respaldado',
        sourceId: seed.id,
        delta: REPUTATION_DELTA.aporte_respaldado,
        createdAt: decidedAt,
      });
    }

    auditRepository.insert({
      id: `aud-decision-${seed.id}`,
      actorId: ADMIN_ID,
      action: 'decision_propuesta',
      entityType: 'proposal',
      entityId: seed.id,
      reason: seed.decision.reason,
      decisionKind: seed.decision.kind,
      createdAt: decidedAt,
    });

    proposalsRepository.saveDecision(seed.id, {
      status: seed.decision.outcome === 'aceptar' ? 'aceptada' : 'rechazada',
      outcome: seed.decision.outcome,
      kind: seed.decision.kind,
      reason: seed.decision.reason,
      markedBaseAsError: false,
      decidedBy: ADMIN_ID,
      decidedAt,
      publishedArticleId,
      publishedVersionId: seed.publishedVersionId ?? null,
    });
  }

  const saved = proposalsRepository.findById(seed.id);
  if (saved?.status !== seed.status) {
    throw new Error(`La semilla de ${seed.id} quedó en ${saved?.status ?? 'nada'} y se esperaba ${seed.status}`);
  }
}

const PROPOSALS: readonly SeedProposal[] = [
  {
    id: 'p-aceptada',
    status: 'aceptada',
    authorId: 'u-ana',
    articleId: 'a-apertura-caja',
    baseVersionId: 'v-apertura-caja-1',
    proposed: APERTURA_V2,
    createdDay: '10-10',
    votingOpenedDay: '10-12',
    votes: [
      { moderatorId: 'u-tomas', choice: 'a_favor', day: '10-13' },
      { moderatorId: 'u-sofia', choice: 'a_favor', day: '10-14' },
      { moderatorId: 'u-raul', choice: 'en_contra', day: '10-15' },
    ],
    closed: { result: 'recomendada', day: '10-16' },
    decision: { outcome: 'aceptar', kind: 'acorde', reason: null, day: '10-20' },
    publishedVersionId: 'v-apertura-caja-2',
  },
  {
    id: 'p-aceptada-excepcional',
    status: 'aceptada',
    authorId: 'u-martin',
    articleId: 'a-cambio-turno',
    baseVersionId: 'v-cambio-turno-1',
    proposed: CAMBIO_TURNO_V2,
    createdDay: '10-14',
    votingOpenedDay: '10-15',
    votes: [{ moderatorId: 'u-tomas', choice: 'a_favor', day: '10-16' }],
    decision: {
      outcome: 'aceptar',
      kind: 'excepcional',
      reason: 'Lo pidió auditoría interna con urgencia y no se llegó al quórum a tiempo.',
      day: '10-22',
    },
    publishedVersionId: 'v-cambio-turno-2',
  },
  {
    id: 'p-rechazada',
    status: 'rechazada',
    authorId: 'u-martin',
    articleId: null,
    baseVersionId: null,
    proposed: {
      title: 'Uso de cámaras en el salón',
      summary: 'Cuándo revisar las grabaciones del salón.',
      categoryId: 'c-seguridad',
      tags: ['seguridad', 'cámaras'],
      sources: [],
      content: '# Uso de cámaras en el salón\n\nCualquier persona del turno puede revisar las grabaciones.\n',
    },
    createdDay: '10-15',
    votingOpenedDay: '10-16',
    votes: [
      { moderatorId: 'u-tomas', choice: 'a_favor', day: '10-17' },
      { moderatorId: 'u-sofia', choice: 'a_favor', day: '10-17' },
      { moderatorId: 'u-raul', choice: 'a_favor', day: '10-18' },
    ],
    closed: { result: 'recomendada', day: '10-19' },
    decision: {
      outcome: 'rechazar',
      kind: 'apartada',
      reason: 'Contradice la política de privacidad vigente. Se trata en el comité de seguridad.',
      day: '10-23',
    },
  },
  {
    id: 'p-recomendada',
    status: 'recomendada',
    authorId: 'u-ana',
    articleId: null,
    baseVersionId: null,
    proposed: {
      title: 'Arqueo semanal',
      summary: 'Control del efectivo de todas las cajas una vez por semana.',
      categoryId: 'c-caja',
      tags: ['caja', 'arqueo'],
      sources: [TESORERIA],
      content: '# Arqueo semanal\n\nCada lunes se controla el efectivo de todas las cajas.\n\n## Pasos\n\n- Contar cada caja.\n- Comparar con el sistema.\n- Informar diferencias.\n',
    },
    createdDay: '10-24',
    votingOpenedDay: '10-25',
    votes: [
      { moderatorId: 'u-tomas', choice: 'a_favor', day: '10-26' },
      { moderatorId: 'u-sofia', choice: 'a_favor', day: '10-26' },
      { moderatorId: 'u-raul', choice: 'en_contra', day: '10-27' },
    ],
    closed: { result: 'recomendada', day: '10-28' },
  },
  {
    id: 'p-desaconsejada',
    status: 'desaconsejada',
    authorId: 'u-martin',
    articleId: 'a-cambio-turno',
    baseVersionId: 'v-cambio-turno-2',
    proposed: {
      ...CAMBIO_TURNO_V2,
      summary: 'Entrega de puesto sin registro escrito.',
      content: '# Cambio de turno\n\nEl turno saliente avisa por mensaje y se retira.\n',
    },
    createdDay: '10-25',
    votingOpenedDay: '10-26',
    votes: [
      { moderatorId: 'u-tomas', choice: 'en_contra', day: '10-27' },
      { moderatorId: 'u-sofia', choice: 'en_contra', day: '10-27' },
      { moderatorId: 'u-raul', choice: 'a_favor', day: '10-28' },
    ],
    closed: { result: 'desaconsejada', day: '10-29' },
  },
  {
    id: 'p-controvertida',
    status: 'controvertida',
    authorId: 'u-ana',
    articleId: null,
    baseVersionId: null,
    proposed: {
      title: 'Protocolo ante alarma',
      summary: 'Qué hacer cuando suena la alarma del local.',
      categoryId: 'c-seguridad',
      tags: ['seguridad', 'alarma'],
      sources: [],
      content: '# Protocolo ante alarma\n\n## Primeros minutos\n\n- Evacuar el salón.\n- Llamar a la empresa de monitoreo.\n',
    },
    createdDay: '10-26',
    votingOpenedDay: '10-27',
    votes: [
      { moderatorId: 'u-tomas', choice: 'a_favor', day: '10-28' },
      { moderatorId: 'u-sofia', choice: 'en_contra', day: '10-28' },
      { moderatorId: 'u-raul', choice: 'a_favor', day: '10-29' },
      { moderatorId: 'u-diego', choice: 'en_contra', day: '10-29' },
    ],
    closed: { result: 'controvertida', day: '10-30' },
  },
  {
    id: 'p-en-votacion',
    status: 'en_votacion',
    authorId: 'u-martin',
    articleId: 'a-apertura-caja',
    baseVersionId: 'v-apertura-caja-2',
    proposed: {
      ...APERTURA_V2,
      content: `${APERTURA_V2.content}
## Si hay diferencia

- Avisar a la persona supervisora antes de operar.
`,
    },
    createdDay: '11-01',
    votingOpenedDay: '11-02',
    votes: [
      { moderatorId: 'u-tomas', choice: 'a_favor', day: '11-03' },
      { moderatorId: 'u-raul', choice: 'en_contra', day: '11-03' },
    ],
  },
  {
    id: 'p-abierta',
    status: 'abierta',
    authorId: 'u-ana',
    articleId: 'a-apertura-caja',
    baseVersionId: 'v-apertura-caja-2',
    proposed: {
      ...APERTURA_V2,
      sources: [TESORERIA, { title: 'Circular de caja 2026', url: 'https://intranet.example.com/circular-caja-2026' }],
      content: APERTURA_V2.content.replace('- Firmar la planilla de apertura.', '- Firmar la planilla de apertura y guardar una copia.'),
    },
    createdDay: '11-04',
  },
];

const COMMENTS = [
  { id: 'cm-1', proposalId: 'p-abierta', authorId: 'u-tomas', body: '¿Podés sumar la circular nueva como fuente?', day: '11-05' },
  { id: 'cm-2', proposalId: 'p-abierta', authorId: 'u-ana', body: 'Listo, ya está en las fuentes.', day: '11-05' },
  { id: 'cm-3', proposalId: 'p-en-votacion', authorId: 'u-sofia', body: 'Me falta saber a quién se avisa si no hay supervisión.', day: '11-03' },
] as const;

export function seedDatabase(): void {
  inTransaction(() => {
    seedUsers();
    seedCategories();

    publishVersion(firstVersion('a-apertura-caja', 'v-apertura-caja-1', APERTURA_V1, '10-05'));
    publishVersion(firstVersion('a-cambio-turno', 'v-cambio-turno-1', CAMBIO_TURNO_V1, '10-06'));
    publishVersion(firstVersion('a-acceso-deposito', 'v-acceso-deposito-1', ACCESO_DEPOSITO_V1, '10-07'));

    for (const proposal of PROPOSALS) seedProposal(proposal);

    for (const comment of COMMENTS) {
      commentsRepository.insert({ ...comment, createdAt: at(comment.day, '15:00') });
    }
  });
}
