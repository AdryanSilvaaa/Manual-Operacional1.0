const adminHash = '$2a$10$aEV41I/MA/qN00fWXu5UCuO/kPA0KT.DG5Br/zho02MdrowLgDIeC';

let nextUserId = 2;
let nextSystemId = 1;
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
const systems = [];
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

  listSystemsForUser(user) {
    const visibleManuals = this.listManualsForUser(user);
    const visibleSystemIds = new Set(visibleManuals.map((manual) => manual.system_id));

    return systems
      .filter((system) => user.role === 'gerente' || visibleSystemIds.has(system.id))
      .map((system) => ({
        ...system,
        manuals_count: visibleManuals.filter((manual) => manual.system_id === system.id).length
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },

  createSystem({ nome, resumo }) {
    const system = {
      id: nextSystemId++,
      nome,
      resumo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    systems.push(system);
    return system;
  },

  updateSystem(id, data) {
    const system = systems.find((item) => Number(item.id) === Number(id));
    if (!system) {
      return null;
    }

    system.nome = data.nome ?? system.nome;
    system.resumo = data.resumo ?? system.resumo;
    system.updated_at = new Date().toISOString();
    return system;
  },

  deleteSystem(id) {
    const index = systems.findIndex((system) => Number(system.id) === Number(id));
    if (index >= 0) {
      systems.splice(index, 1);
    }

    manuals.forEach((manual) => {
      if (Number(manual.system_id) === Number(id)) {
        manual.system_id = null;
      }
    });
  },

  listManualsForUser(user, systemId = null) {
    const inSystem = (manual) => !systemId || Number(manual.system_id) === Number(systemId);

    if (user.role === 'gerente') {
      return manuals.filter(inSystem);
    }

    return manuals.filter((manual) => {
      const allowed = permissions.filter((item) => item.manual_id === manual.id);
      return inSystem(manual) && (allowed.length === 0 || allowed.some((item) => item.user_id === user.id));
    });
  },

  getManualForUser(id, user) {
    return this.listManualsForUser(user).find((manual) => Number(manual.id) === Number(id));
  },

  createManual({ titulo, descricao, pdfUrl, videoUrl, systemId, criadoPor }) {
    const manual = {
      id: nextManualId++,
      titulo,
      descricao,
      pdf_url: pdfUrl,
      video_url: videoUrl,
      system_id: systemId ? Number(systemId) : null,
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
    manual.system_id = data.systemId ?? manual.system_id;
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
