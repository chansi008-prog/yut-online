// 윷판 온라인 서비스 워커: 앱 화면 파일만 저장해 둔다 (게임 데이터는 Firebase로 실시간 주고받음)
const VERSION = "yutol-v2";
const CORE = ["./", "index.html", "net.js", "config.js", "manifest.webmanifest", ...["mouse","cow","tiger","rabbit","dragon","snake","horse","sheep","monkey","rooster","dog","pig","bengal","fox","bear","panda","chick","frog","koala","hamster","penguin","lion","soccer","helmet"].map(k => `animals/${k}.png`), "icons/online-192-v2.png", "icons/online-512-v2.png", "icons/online-touch-v2.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 앱 파일: 인터넷이 되면 새 파일을 먼저(온라인 게임은 모두 같은 버전이어야 하니까), 안 되면 저장본
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const same = url.origin === location.origin;
  if (!same && !url.host.endsWith("fonts.googleapis.com") && !url.host.endsWith("fonts.gstatic.com")) return;
  const key = e.request.mode === "navigate" ? "index.html" : e.request;
  e.respondWith(caches.open(VERSION).then(async c => {
    try {
      const r = await fetch(e.request);
      if (r.ok || r.type === "opaque") c.put(key, r.clone());
      return r;
    } catch {
      const hit = await c.match(key, { ignoreSearch: true });
      if (hit) return hit;
      throw new Error("offline");
    }
  }));
});
