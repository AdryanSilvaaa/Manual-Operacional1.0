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

export function requireManager(req, res, next) {
  if (req.user?.role !== 'gerente') {
    return res.status(403).json({ message: 'Acesso permitido apenas para gerente' });
  }

  next();
}
