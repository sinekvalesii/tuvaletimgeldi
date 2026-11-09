// Firebase tabanlı gerçek arka uç: herkes aynı veriyi görür.
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  getCountFromServer,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { geohashEncode, geohashesForBounds } from './geo.js';

export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
  const db = getFirestore(app);
  const storage = getStorage(app);

  let current = null;
  const cellCache = new Map(); // geohash -> { t, items }
  const CELL_TTL = 1000 * 60 * 2;

  async function toUser(fbUser) {
    if (!fbUser) return null;
    let isAdmin = false;
    try {
      isAdmin = (await getDoc(doc(db, 'admins', fbUser.uid))).exists();
    } catch {}
    return {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || (fbUser.email || '').split('@')[0],
      isAdmin,
    };
  }

  const tsToMs = (v) => (v?.toMillis ? v.toMillis() : v || 0);

  function toiletFromDoc(d) {
    const x = d.data();
    return {
      id: d.id,
      source: 'community',
      name: x.name,
      type: x.type,
      lat: x.lat,
      lng: x.lng,
      fee: x.fee ?? null,
      wheelchair: x.wheelchair ?? null,
      baby: !!x.baby,
      description: x.description || '',
      photoUrl: x.photoUrl || '',
      addedBy: x.addedBy,
      addedByName: x.addedByName || '',
      createdAt: tsToMs(x.createdAt),
    };
  }

  return {
    mode: 'firebase',

    onAuthChange(cb) {
      return onAuthStateChanged(auth, async (u) => {
        current = await toUser(u);
        cb(current);
      });
    },

    currentUser: () => current,

    async register(name, email, password) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayName: name,
        createdAt: serverTimestamp(),
      });
      current = await toUser(auth.currentUser);
      return current;
    },

    async login(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      current = await toUser(cred.user);
      return current;
    },

    resetPassword: (email) => sendPasswordResetEmail(auth, email),

    logout: () => signOut(auth),

    async deleteAccount(password) {
      const u = auth.currentUser;
      if (!u) return;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
      // 1) Yorumları sil
      const reviews = await getDocs(query(collectionGroup(db, 'reviews'), where('uid', '==', u.uid)));
      // 2) Eklenen tuvaletleri anonimleştir
      const toilets = await getDocs(query(collection(db, 'toilets'), where('addedBy', '==', u.uid)));
      const docs = [...reviews.docs.map((d) => ['del', d.ref]), ...toilets.docs.map((d) => ['anon', d.ref])];
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        for (const [op, r] of docs.slice(i, i + 400)) {
          if (op === 'del') batch.delete(r);
          else batch.update(r, { addedBy: 'deleted', addedByName: '' });
        }
        await batch.commit();
      }
      await deleteDoc(doc(db, 'users', u.uid)).catch(() => {});
      await deleteUser(u);
      current = null;
    },

    async listToilets(s, w, n, e) {
      const hashes = geohashesForBounds(s, w, n, e, 4);
      if (hashes.length > 12) return [];
      const now = Date.now();
      const results = await Promise.all(
        hashes.map(async (h) => {
          const c = cellCache.get(h);
          if (c && now - c.t < CELL_TTL) return c.items;
          const snap = await getDocs(
            query(collection(db, 'toilets'), where('geohash', '>=', h), where('geohash', '<', h + '~'), limit(500)),
          );
          const items = snap.docs.map(toiletFromDoc);
          cellCache.set(h, { t: now, items });
          return items;
        }),
      );
      return results.flat();
    },

    async getToilet(id) {
      const d = await getDoc(doc(db, 'toilets', id));
      return d.exists() ? toiletFromDoc(d) : null;
    },

    async addToilet(data, photoBlob) {
      const refDoc = doc(collection(db, 'toilets'));
      let photoUrl = '';
      if (photoBlob) {
        const r = ref(storage, `toilet-photos/${current.uid}/${refDoc.id}.jpg`);
        await uploadBytes(r, photoBlob, { contentType: 'image/jpeg' });
        photoUrl = await getDownloadURL(r);
      }
      await setDoc(refDoc, {
        ...data,
        geohash: geohashEncode(data.lat, data.lng, 9),
        photoUrl,
        addedBy: current.uid,
        addedByName: current.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      cellCache.clear();
      return refDoc.id;
    },

    async updateToilet(id, data, photoBlob, ownerUid) {
      const patch = { ...data, geohash: geohashEncode(data.lat, data.lng, 9), updatedAt: serverTimestamp() };
      if (photoBlob) {
        const r = ref(storage, `toilet-photos/${ownerUid || current.uid}/${id}.jpg`);
        await uploadBytes(r, photoBlob, { contentType: 'image/jpeg' });
        patch.photoUrl = await getDownloadURL(r);
      }
      await updateDoc(doc(db, 'toilets', id), patch);
      cellCache.clear();
    },

    async deleteToilet(toilet) {
      await deleteDoc(doc(db, 'toilets', toilet.id));
      if (toilet.photoUrl && toilet.addedBy && toilet.addedBy !== 'deleted') {
        await deleteObject(ref(storage, `toilet-photos/${toilet.addedBy}/${toilet.id}.jpg`)).catch(() => {});
      }
      cellCache.clear();
    },

    async getReviews(placeId) {
      const snap = await getDocs(
        query(collection(db, 'places', placeId, 'reviews'), orderBy('createdAt', 'desc'), limit(50)),
      );
      return snap.docs.map((d) => ({ ...d.data(), id: d.id, createdAt: tsToMs(d.data().createdAt) }));
    },

    async saveReview(placeId, { rating, comment, clean }) {
      await setDoc(doc(db, 'places', placeId, 'reviews', current.uid), {
        uid: current.uid,
        userName: current.displayName,
        rating,
        comment,
        clean,
        createdAt: serverTimestamp(),
      });
    },

    deleteReview: (placeId, uid) => deleteDoc(doc(db, 'places', placeId, 'reviews', uid)),

    async report({ placeId, reviewUid = null, reason, label }) {
      await addDoc(collection(db, 'reports'), {
        placeId,
        reviewUid,
        reason,
        label: (label || '').slice(0, 120),
        by: current?.uid || null,
        status: 'open',
        createdAt: serverTimestamp(),
      });
    },

    async listReports() {
      const snap = await getDocs(
        query(collection(db, 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(50)),
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToMs(d.data().createdAt) }));
    },

    resolveReport: (id) => updateDoc(doc(db, 'reports', id), { status: 'resolved' }),

    async hidePlace(placeId) {
      await setDoc(doc(db, 'hidden', placeId), { at: serverTimestamp() });
    },

    async listHidden() {
      try {
        const snap = await getDocs(collection(db, 'hidden'));
        return snap.docs.map((d) => d.id);
      } catch {
        return [];
      }
    },

    async myStats() {
      if (!current) return { toilets: 0, reviews: 0 };
      const [t, r] = await Promise.all([
        getCountFromServer(query(collection(db, 'toilets'), where('addedBy', '==', current.uid))),
        getCountFromServer(query(collectionGroup(db, 'reviews'), where('uid', '==', current.uid))),
      ]);
      return { toilets: t.data().count, reviews: r.data().count };
    },
  };
}
