import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function signToken(userDoc) {
  return jwt.sign(
    { sub: userDoc.id, email: userDoc.email, role: userDoc.role, name: userDoc.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}
