const admin = require('firebase-admin');

// Verifica el header "Authorization: Bearer <idToken>" que manda el frontend
// después de que el usuario hace login con Firebase Auth.
// Si es válido, agrega req.user = { uid, email } y deja pasar.
// Si no, responde 401 antes de llegar a la ruta real.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de autenticación' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { requireAuth };
