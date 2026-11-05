/* 연세춘추 통합 첫 화면: 연도 목록 + 전체 연도 검색
 * years.js → window.CC_YEARS [{year,first,last,issues,pages,articles}]
 * {연도}/data/articles.js → window.CC_DATA[연도] (검색할 때 처음 한 번 불러옴)
 */
(() => {
  "use strict";
  const KEY_HASH = "678f2f24525785e9460d8f8599e6006f0187765f6285842f4e8ff74f772ea803";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, "");
  const store = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} } };
  const Y = window.CC_YEARS || [];
  const st = { terms: [], hits: [], year: "all", shown: 0, loaded: false };
  const PAGE = 100;
  const yu = (y) => (window.CC_YEARURL || "{y}/").replace("{y}", y);

  async function sha256(s) {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    }
    return s === "3893" ? KEY_HASH : "x";
  }
  function unlock() { store.set("cc_ok", "1"); $("#gate").hidden = true; $("#app").hidden = false; init(); }
  $("#gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ((await sha256($("#gateKey").value.trim())) === KEY_HASH) unlock();
    else { $("#gateMsg").textContent = "키워드가 맞지 않습니다."; $("#gateKey").select(); }
  });

  const total = (k) => Y.reduce((n, y) => n + y[k], 0);
  const span = Y.length ? `${Y[0].year}–${Y.at(-1).year}` : "";
  $("#gateSub").textContent = `지면 아카이브 · ${span}`;

  function init() {
    $("#span").textContent = `지면 아카이브 ${span}`;
    $("#stats").textContent = `${Y.length}개 연도 · ${total("issues")}개 호 · ${total("pages").toLocaleString()}면 · 기사 ${total("articles").toLocaleString()}건`;
    $("#yearGrid").innerHTML = Y.map((y) => `
      <a class="year-card" href="${yu(y.year)}index.html#u=1">
        <div class="cover"><img src="${yu(y.year)}img/${y.first}/p01.jpg" alt="" loading="lazy" onerror="this.remove()"></div>
        <div class="yc-body">
          <div class="yc-year">${y.year}</div>
          <div class="yc-meta">제${y.first}호 – 제${y.last}호</div>
          <div class="yc-meta">${y.issues}개 호 · ${y.pages}면 · 기사 ${y.articles.toLocaleString()}건</div>
        </div>
      </a>`).join("");
    $("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); search($("#q").value); });
    $("#resClose").onclick = () => { $("#results").hidden = true; $("#q").value = ""; history.replaceState(null, "", "#"); };
    $("#more").onclick = () => renderList(true);
    const q = new URLSearchParams(location.hash.slice(1)).get("q");
    if (q) { $("#q").value = q; search(q); }
  }

  function loadScript(src) {
    return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.head.appendChild(s); });
  }
  async function loadAll() {
    if (st.loaded) return;
    const L = $("#loading"); L.hidden = false;
    let n = 0;
    for (const y of Y) {
      L.textContent = `기사 자료를 불러오는 중… (${++n}/${Y.length}, ${y.year}년)`;
      if (!(window.CC_DATA && window.CC_DATA[y.year])) {
        try { await loadScript(`${yu(y.year)}data/articles.js`); } catch { continue; }
      }
      for (const a of window.CC_DATA[y.year]) { a._y = y.year; a._h = norm(a.t + " " + a.a + " " + a.x); }
    }
    st.loaded = true; L.hidden = true;
  }

  async function search(q) {
    q = q.trim(); if (!q) return;
    history.replaceState(null, "", "#q=" + encodeURIComponent(q));
    $("#results").hidden = false; $("#resTitle").textContent = `‘${q}’ 검색 중…`; $("#resList").innerHTML = ""; $("#yearChips").innerHTML = ""; $("#more").hidden = true;
    await loadAll();
    st.terms = q.split(/\s+/).filter(Boolean);
    const ts = st.terms.map(norm);
    const hits = [];
    for (const y of Y) for (const a of (window.CC_DATA && window.CC_DATA[y.year]) || []) if (ts.every((t) => a._h.includes(t))) hits.push(a);
    const inTitle = (a) => ts.every((t) => norm(a.t).includes(t));
    hits.sort((p, r) => (inTitle(r) - inTitle(p)) || p._y - r._y || p.id - r.id);
    st.hits = hits; st.year = "all";
    $("#resTitle").textContent = `‘${q}’ 검색 결과 ${hits.length.toLocaleString()}건`;
    const by = {}; hits.forEach((a) => (by[a._y] = (by[a._y] || 0) + 1));
    $("#yearChips").innerHTML = `<button class="chip is-on" data-y="all">전체 ${hits.length}</button>` +
      Y.map((y) => `<button class="chip" data-y="${y.year}" ${by[y.year] ? "" : "disabled"}>${y.year} <b>${by[y.year] || 0}</b></button>`).join("");
    $$("#yearChips .chip").forEach((c) => (c.onclick = () => { st.year = c.dataset.y; $$("#yearChips .chip").forEach((x) => x.classList.toggle("is-on", x === c)); renderList(false); }));
    renderList(false);
    $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function termRe() {
    const parts = st.terms.map((t) => [...t].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*"));
    return parts.length ? new RegExp(parts.join("|"), "gi") : null;
  }
  function hl(s) { const re = termRe(); s = esc(s); return re ? s.replace(new RegExp(re.source.replace(/&/g, "&amp;"), "gi"), (m) => `<mark>${m}</mark>`) : s; }
  function snippet(x) {
    if (!x) return ""; const re = termRe(); let i = 0;
    if (re) { const m = re.exec(x); if (m) i = Math.max(0, m.index - 50); }
    return (i ? "…" : "") + hl(x.slice(i, i + 160).replace(/\n/g, " ")) + "…";
  }
  function renderList(more) {
    const list = st.hits.filter((a) => st.year === "all" || String(a._y) === st.year);
    if (!more) { st.shown = 0; $("#resList").innerHTML = ""; }
    const q = encodeURIComponent($("#q").value.trim());
    const chunk = list.slice(st.shown, st.shown + PAGE);
    $("#resList").insertAdjacentHTML("beforeend", chunk.map((a) => `
      <li><a class="res" href="${yu(a._y)}index.html#a=${a.id}&q=${q}&u=1">
        <div class="res-meta"><span class="res-year">${a._y}</span><span>제${a.i}호 ${a.p}면</span>${a.a ? `<span>${esc(a.a)}</span>` : ""}${a.m === 6 ? `<span class="res-auto">자동 추출</span>` : ""}</div>
        <div class="res-title">${hl(a.t)}</div>
        <div class="res-snip">${snippet(a.x)}</div>
      </a></li>`).join(""));
    st.shown += chunk.length;
    $("#more").hidden = st.shown >= list.length;
    if (!list.length) $("#resList").innerHTML = `<li class="empty">맞는 기사가 없습니다.</li>`;
  }

  if (store.get("cc_ok") === "1" || /(^|[#&])u=1(&|$)/.test(location.hash)) unlock(); else $("#gateKey").focus();
})();
