// DEMO arka uç: Firebase ayarları girilmediğinde kullanılır.
// Tüm veriler bu cihazın tarayıcı deposunda kalır. Yayın için kullanmayın.

const K = {
  users: 'tg_demo_users',
  session: 'tg_demo_session',
  toilets: 'tg_demo_toilets',
  reviews: 'tg_demo_reviews',
  reports: 'tg_demo_reports',
  hidden: 'tg_demo_hidden',
};

const read = (k, def) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {
    throw new Error('storage-full');
  }
};

async function hash(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('tg-demo:' + s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function authError(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

const blobToDataUrl = (blob) =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(blob);
  });

export function createDemoBackend() {
  let current = null;
  let listener = () => {};

  function publicUser(u) {
    return u ? { uid: u.uid, email: u.email, displayName: u.displayName, isAdmin: !!u.isAdmin } : null;
  }

  return {
    mode: 'demo',

    onAuthChange(cb) {
      listener = cb;
      const uid = read(K.session, null);
      const users = read(K.users, {});
      current = publicUser(Object.values(users).find((u) => u.uid === uid));
      setTimeout(() => cb(current), 0);
      return () => {};
    },

    currentUser: () => current,

    async register(name, email, password) {
      email = email.toLowerCase();
      const users = read(K.users, {});
      if (users[email]) throw authError('auth/email-already-in-use');
      // Demo modda ilk kayıt olan kişi yönetici olur (test kolaylığı için)
      const isAdmin = Object.keys(users).length === 0;
      users[email] = { uid: 'u' + Date.now(), email, displayName: name, pw: await hash(password), isAdmin };
      write(K.users, users);
      write(K.session, users[email].uid);
      current = publicUser(users[email]);
      listener(current);
      return current;
    },

    async login(email, password) {
      const u = read(K.users, {})[email.toLowerCase()];
      if (!u || u.pw !== (await hash(password))) throw authError('auth/invalid-credential');
      write(K.session, u.uid);
      current = publicUser(u);
      listener(current);
      return current;
    },

    async resetPassword() {
      // Demo modda e-posta gönderilmez
    },

    async logout() {
      localStorage.removeItem(K.session);
      current = null;
      listener(null);
    },

    async deleteAccount(password) {
      const users = read(K.users, {});
      const u = users[current.email];
      if (!u || u.pw !== (await hash(password))) throw authError('auth/invalid-credential');
      delete users[current.email];
      write(K.users, users);
      const reviews = read(K.reviews, {});
      for (const pid in reviews) delete reviews[pid][current.uid];
      write(K.reviews, reviews);
      const toilets = read(K.toilets, {});
      for (const id in toilets) if (toilets[id].addedBy === current.uid) {
        toilets[id].addedBy = 'deleted';
        toilets[id].addedByName = '';
      }
      write(K.toilets, toilets);
      localStorage.removeItem(K.session);
      current = null;
      listener(null);
    },

    async listToilets(s, w, n, e) {
      return Object.values(read(K.toilets, {})).filter(
        (x) => x.lat >= s && x.lat <= n && x.lng >= w && x.lng <= e,
      );
    },

    async getToilet(id) {
      return read(K.toilets, {})[id] || null;
    },

    async addToilet(data, photoBlob) {
      const toilets = read(K.toilets, {});
      const id = 'c' + Date.now();
      toilets[id] = {
        ...data,
        id,
        source: 'community',
        photoUrl: photoBlob ? await blobToDataUrl(photoBlob) : '',
        addedBy: current.uid,
        addedByName: current.displayName,
        createdAt: Date.now(),
      };
      write(K.toilets, toilets);
      return id;
    },

    async updateToilet(id, data, photoBlob) {
      const toilets = read(K.toilets, {});
      Object.assign(toilets[id], data);
      if (photoBlob) toilets[id].photoUrl = await blobToDataUrl(photoBlob);
      write(K.toilets, toilets);
    },

    async deleteToilet(toilet) {
      const toilets = read(K.toilets, {});
      delete toilets[toilet.id];
      write(K.toilets, toilets);
    },

    async getReviews(placeId) {
      const r = read(K.reviews, {})[placeId] || {};
      return Object.values(r).sort((a, b) => b.createdAt - a.createdAt);
    },

    async saveReview(placeId, { rating, comment, clean }) {
      const all = read(K.reviews, {});
      all[placeId] = all[placeId] || {};
      all[placeId][current.uid] = {
        id: current.uid,
        uid: current.uid,
        userName: current.displayName,
        rating,
        comment,
        clean,
        createdAt: Date.now(),
      };
      write(K.reviews, all);
    },

    async deleteReview(placeId, uid) {
      const all = read(K.reviews, {});
      if (all[placeId]) delete all[placeId][uid];
      write(K.reviews, all);
    },

    async report(r) {
      const all = read(K.reports, []);
      all.unshift({ ...r, id: 'r' + Date.now(), by: current?.uid || null, status: 'open', createdAt: Date.now() });
      write(K.reports, all.slice(0, 100));
    },

    async listReports() {
      return read(K.reports, []).filter((r) => r.status === 'open');
    },

    async resolveReport(id) {
      const all = read(K.reports, []);
      const r = all.find((x) => x.id === id);
      if (r) r.status = 'resolved';
      write(K.reports, all);
    },

    async hidePlace(placeId) {
      const h = read(K.hidden, []);
      if (!h.includes(placeId)) h.push(placeId);
      write(K.hidden, h);
    },

    async listHidden() {
      return read(K.hidden, []);
    },

    async myStats() {
      if (!current) return { toilets: 0, reviews: 0 };
      const toilets = Object.values(read(K.toilets, {})).filter((x) => x.addedBy === current.uid).length;
      let reviews = 0;
      for (const p of Object.values(read(K.reviews, {}))) if (p[current.uid]) reviews++;
      return { toilets, reviews };
    },
  };
}
