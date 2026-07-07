const adminHash = '$2a$10$aEV41I/MA/qN00fWXu5UCuO/kPA0KT.DG5Br/zho02MdrowLgDIeC';

let nextUserId = 2;
let nextManualId = 1;

const users = [
  {
    id: 1,
    nome: 'Gerente Admin',
    email: 'admin@manual.local',
    senha: adminHash,
    role: 'gerente',
    created_at: new Date().toISOString()
  }
];

const manuals = [];
const permissions = [];

export function demoEnabled() {
  return process.env.DEV_DEMO_MODE === 'true';
}

export function isDatabaseUnavailable(error) {
  return ['28P01', 'ECONNREFUSED', '3D000'].includes(error?.code);
}

export function shouldUseDemoStore(error) {
  return demoEnabled() && isDatabaseUnavailable(error);
}

export const demoStore = {
  findUserByEmail(email) {
    return users.find((user) => user.email === email);
  },

  findUserById(id) {
    const user = users.find((item) => Number(item.id) === Number(id));
    if (!user) {
      return null;
    }

    const { senha, ...safeUser } = user;
    return safeUser;
  },

  listUsers() {
    return users
      .map(({ senha, ...user }) => user)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },

  createUser({ nome, email, senhaHash, role }) {
    const user = {
      id: nextUserId++,
      nome,
      email,
      senha: senhaHash,
      role,
      created_at: new Date().toISOString()
    };
    users.push(user);
    const { senha, ...safeUser } = user;
    return safeUser;
  },

  deleteUser(id) {
    const index = users.findIndex((user) => Number(user.id) === Number(id));
    if (index >= 0) {
      users.splice(index, 1);
    }
  },

  listManualsForUser(user) {
    if (user.role === 'gerente') {
      return manuals;
    }

    return manuals.filter((manual) => {
      const allowed = permissions.filter((item) => item.manual_id === manual.id);
      return allowed.length === 0 || allowed.some((item) => item.user_id === user.id);
    });
  },

  getManualForUser(id, user) {
    return this.listManualsForUser(user).find((manual) => Number(manual.id) === Number(id));
  },

  createManual({ titulo, descricao, pdfUrl, videoUrl, criadoPor }) {
    const manual = {
      id: nextManualId++,
      titulo,
      descricao,
      pdf_url: pdfUrl,
      video_url: videoUrl,
      criado_por: criadoPor,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    manuals.unshift(manual);
    return manual;
  },

  updateManual(id, data) {
    const manual = manuals.find((item) => Number(item.id) === Number(id));
    if (!manual) {
      return null;
    }

    manual.titulo = data.titulo ?? manual.titulo;
    manual.descricao = data.descricao ?? manual.descricao;
    manual.pdf_url = data.pdfUrl ?? manual.pdf_url;
    manual.video_url = data.videoUrl ?? manual.video_url;
    manual.updated_at = new Date().toISOString();
    return manual;
  },

  deleteManual(id) {
    const index = manuals.findIndex((manual) => Number(manual.id) === Number(id));
    if (index >= 0) {
      manuals.splice(index, 1);
    }
  },

  replaceManualPermissions(manualId, userIds) {
    for (let index = permissions.length - 1; index >= 0; index -= 1) {
      if (Number(permissions[index].manual_id) === Number(manualId)) {
        permissions.splice(index, 1);
      }
    }

    userIds.forEach((userId) => {
      permissions.push({ manual_id: Number(manualId), user_id: Number(userId) });
    });
  }
};
