const supabase = require('../lib/supabase');

async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = header.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Token invalide' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Erreur authentification' });
  }
}

module.exports = { verifyToken };
