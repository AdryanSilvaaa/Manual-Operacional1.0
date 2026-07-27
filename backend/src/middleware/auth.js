import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token nao informado' });
  }

  try {
    const token = header.replace('Bearer ', '');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalido ou expirado' });
  }
}

// Suporte administra usuarios, setores e sistemas.
export function requireSupport(req, res, next) {
  if (!['suporte', 'gerente'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Acesso permitido apenas para suporte' });
  }

  next();
}

// Suporte e gerente de setor podem cadastrar materiais operacionais.
export function requireManualManager(req, res, next) {
  if (!['suporte', 'gerente_setor', 'gerente'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Acesso permitido apenas para gerente de setor ou suporte' });
  }
  next();
}
