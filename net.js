// 윷판 온라인 연결부
// config.js 에 Firebase 설정이 있으면 Firebase 실시간 데이터베이스로,
// 없으면 "테스트 모드"로 같은 브라우저의 탭끼리만 연결한다 (탭 하나 = 사람 한 명).
// 앱은 아래 함수들만 쓴다: uid, mock, now(), get, set, update, remove, push, on, tx, presence, cancelPresence, cleanup
// 값 "__TS__" 는 서버 시각으로 바뀐다.

const TS = "__TS__";
const DAY = 24 * 60 * 60 * 1000;

export async function connect(config) {
  if (config && config.apiKey && config.databaseURL) return firebaseDB(config);
  return mockDB();
}

/* ───────── Firebase ───────── */
async function firebaseDB(config) {
  const V = "10.12.2", base = `https://www.gstatic.com/firebasejs/${V}`;
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const A = await import(`${base}/firebase-auth.js`);
  const D = await import(`${base}/firebase-database.js`);
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  // 로그인 화면 없이 기기마다 익명 아이디를 받는다 (같은 기기로 다시 열면 같은 아이디)
  await A.signInAnonymously(auth);
  const db = D.getDatabase(app);
  let offset = 0;
  D.onValue(D.ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
  const ts = v => {
    if (v === TS) return D.serverTimestamp();
    if (v && typeof v === "object" && !Array.isArray(v)) { const o = {}; for (const k in v) o[k] = ts(v[k]); return o; }
    return v;
  };
  const R = p => D.ref(db, p);
  let pres = null;
  return {
    uid: auth.currentUser.uid,
    mock: false,
    now: () => Date.now() + offset,
    get: async p => (await D.get(R(p))).val(),
    set: (p, v) => D.set(R(p), ts(v)),
    update: (p, obj) => { const o = {}; for (const k in obj) o[`${p}/${k}`] = ts(obj[k]); return D.update(R("/"), o); },
    remove: p => D.remove(R(p)),
    push: (p, v) => D.push(R(p), ts(v)),
    on: (p, cb) => D.onValue(R(p), s => cb(s.val())),
    tx: async (p, fn) => { const r = await D.runTransaction(R(p), fn, { applyLocally: false }); return { committed: r.committed }; },
    presence(p, onVal, offVal) {
      this.cancelPresence();
      const unsub = D.onValue(R(".info/connected"), s => {
        if (s.val() !== true) return;
        D.onDisconnect(R(p)).update(ts(offVal)).then(() => D.update(R(p), ts(onVal)));
      });
      pres = { p, unsub };
    },
    async cancelPresence() {
      if (!pres) return;
      pres.unsub(); await D.onDisconnect(R(pres.p)).cancel().catch(() => {}); pres = null;
    },
    // 하루 지난 방은 지운다
    async cleanup() {
      const q = D.query(R("rooms"), D.orderByChild("meta/created"), D.endAt(Date.now() + offset - DAY - 5 * 60 * 1000));
      const s = await D.get(q);
      const jobs = [];
      s.forEach(c => { jobs.push(D.remove(c.ref)); });
      await Promise.all(jobs);
    },
  };
}

/* ───────── 테스트 모드 (localStorage) ───────── */
function mockDB() {
  const KEY = "yutol.mockdb";
  let uid = null;
  try { uid = sessionStorage.getItem("yutol.mockuid"); } catch {}
  if (!uid) { uid = "u" + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem("yutol.mockuid", uid); } catch {} }

  const keys = p => String(p).split("/").filter(Boolean);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const at = (root, p) => keys(p).reduce((o, k) => (o == null ? undefined : o[k]), root);
  // Firebase처럼 null·빈 배열·빈 객체는 저장하지 않는다
  const prune = v => {
    if (v === TS) return Date.now();
    if (Array.isArray(v)) { const a = v.map(prune); return a.every(x => x === undefined) ? undefined : a.map(x => (x === undefined ? null : x)); }
    if (v && typeof v === "object") { const o = {}; for (const k in v) { const x = prune(v[k]); if (x !== undefined) o[k] = x; } return Object.keys(o).length ? o : undefined; }
    return v === null ? undefined : v;
  };
  const put = (root, p, v) => {
    const ks = keys(p); let o = root;
    for (let i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== "object" || o[ks[i]] === null) o[ks[i]] = {}; o = o[ks[i]]; }
    const x = prune(v);
    if (x === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = x;
  };
  const listeners = new Set();
  const fire = () => {
    const root = read();
    for (const l of listeners) {
      const v = at(root, l.p), s = JSON.stringify(v === undefined ? null : v);
      if (s !== l.last) { l.last = s; l.cb(JSON.parse(s)); }
    }
  };
  const write = root => { localStorage.setItem(KEY, JSON.stringify(root)); setTimeout(fire, 0); };
  addEventListener("storage", e => { if (e.key === KEY) fire(); });
  let pres = null;
  const api = {
    uid, mock: true,
    now: () => Date.now(),
    get: async p => { const v = at(read(), p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); },
    set: async (p, v) => { const r = read(); put(r, p, v); write(r); },
    update: async (p, obj) => { const r = read(); for (const k in obj) put(r, `${p}/${k}`, obj[k]); write(r); },
    remove: async p => { const r = read(); put(r, p, null); write(r); },
    push: async (p, v) => { const r = read(); put(r, `${p}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, v); write(r); },
    on: (p, cb) => { const l = { p, cb, last: undefined }; listeners.add(l); setTimeout(fire, 0); return () => listeners.delete(l); },
    tx: async (p, fn) => {
      const r = read(), cur = at(r, p);
      const nv = fn(cur === undefined ? null : JSON.parse(JSON.stringify(cur)));
      if (nv === undefined) return { committed: false };
      put(r, p, nv); write(r); return { committed: true };
    },
    presence(p, onVal, offVal) {
      this.cancelPresence();
      const off = () => { const r = read(); if (at(r, p)) { for (const k in offVal) put(r, `${p}/${k}`, offVal[k]); localStorage.setItem(KEY, JSON.stringify(r)); } };
      addEventListener("pagehide", off);
      pres = { off };
      api.update(p, onVal);
    },
    async cancelPresence() { if (pres) { removeEventListener("pagehide", pres.off); pres = null; } },
    async cleanup() {
      const r = read(); const rooms = r.rooms || {};
      for (const c in rooms) if (!rooms[c].meta || rooms[c].meta.created < Date.now() - DAY) delete rooms[c];
      write(r);
    },
  };
  return api;
}
