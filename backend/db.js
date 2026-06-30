const admin = require('firebase-admin');

// ── INIT (una sola vez, reusa conexión entre invocaciones serverless) ──
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const jobsCol = db.collection('jobs');
const profileCol = db.collection('profile');
const scrapeLogCol = db.collection('scrape_log');

async function initDb() {
  // Firestore crea las colecciones solas al insertar el primer doc,
  // así que no hay nada que inicializar de antemano por ahora.
}

// Crea el perfil default de un usuario nuevo (llamar al hacer signup,
// o on-demand la primera vez que getProfile no encuentra nada).
async function ensureProfile(uid) {
  const ref = profileCol.doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      user_id: uid,
      name: 'Mi Perfil',
      skills: ['React', 'TypeScript', 'JavaScript', 'CSS'],
      experience_years: 3,
      desired_role: 'Frontend Developer',
      keywords: ['frontend developer', 'react developer', 'ui engineer'],
      preferred_locations: ['Argentina', 'Remote', 'Remoto'],
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

const stmts = {
  // El id del doc combina uid + url para deduplicar por usuario
  // (dos usuarios distintos pueden tener guardado el mismo job).
  insertJob: async (uid, j) => {
    const id = `${uid}_${Buffer.from(j.url).toString('base64url')}`;
    const ref = jobsCol.doc(id);
    const snap = await ref.get();
    if (snap.exists) return { inserted: false };
    await ref.set({
      user_id: uid,
      title: j.title,
      company: j.company,
      location: j.location || null,
      salary: j.salary || null,
      url: j.url,
      description: j.description || null,
      tags: j.tags || null,
      source: j.source || null,
      posted_at: j.posted_at || null,
      scraped_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'new',
      match_score: null,
      ai_analysis: null,
      notes: null,
      next_action: null,
      next_action_date: null,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { inserted: true, id };
  },

  // Para todos los update/get de un job puntual: siempre comprobamos
  // que el doc pertenezca al uid antes de tocarlo, así un usuario no
  // puede modificar el job de otro adivinando el id.
  updateJobStatus: async (uid, j) => {
    const ref = jobsCol.doc(j.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data().user_id !== uid) {
      throw new Error('Job no encontrado o no pertenece al usuario');
    }
    return ref.update({
      status: j.status,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  },

  updateJobAnalysis: async (uid, j) => {
    const ref = jobsCol.doc(j.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data().user_id !== uid) {
      throw new Error('Job no encontrado o no pertenece al usuario');
    }
    return ref.update({
      match_score: j.match_score,
      ai_analysis: j.ai_analysis,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  },

  updateJobNotes: async (uid, j) => {
    const ref = jobsCol.doc(j.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data().user_id !== uid) {
      throw new Error('Job no encontrado o no pertenece al usuario');
    }
    return ref.update({
      notes: j.notes,
      next_action: j.next_action,
      next_action_date: j.next_action_date,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  },

  getProfile: async (uid) => {
    await ensureProfile(uid);
    const snap = await profileCol.doc(uid).get();
    return { id: uid, ...snap.data() };
  },

  updateProfile: async (uid, p) => profileCol.doc(uid).set({
    user_id: uid,
    name: p.name,
    skills: p.skills,
    experience_years: p.experience_years,
    desired_role: p.desired_role,
    desired_salary_min: p.desired_salary_min,
    desired_salary_max: p.desired_salary_max,
    preferred_locations: p.preferred_locations,
    keywords: p.keywords,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true }),

  logScrape: async (uid, l) => scrapeLogCol.add({
    user_id: uid,
    source: l.source,
    keyword: l.keyword,
    found: l.found,
    new_jobs: l.new_jobs,
    error: l.error || null,
    ran_at: admin.firestore.FieldValue.serverTimestamp(),
  }),

  getAllJobs: async (uid) => {
    const snap = await jobsCol
      .where('user_id', '==', uid)
      .orderBy('scraped_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  getJobById: async (uid, id) => {
    const snap = await jobsCol.doc(id).get();
    if (!snap.exists || snap.data().user_id !== uid) return null;
    return { id: snap.id, ...snap.data() };
  },
};

module.exports = { db, initDb, ensureProfile, stmts };
