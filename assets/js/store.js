// 本地状态：自测结果、历史记录、方剂库筛选
// 全部存在浏览器，不上传、不带账号。

const K_RESULTS = "sf.results.v3";
const K_LIB = "sf.lib.v2";
const MAX_KEEP = 8;
const TTL = 90 * 864e5; // 超过 90 天视为过期

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* 隐私模式或配额满，忽略 */
  }
}

function drop(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 忽略 */
  }
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── 自测结果 ─────────────────────────────────────────── */

/** 结果全部存在浏览器里；同一套作答重复出现时只更新时间，不重复堆记录 */
export function saveResult({ answers, includeC, top, count }) {
  if (!answers || typeof answers !== "object") return null;
  const key = JSON.stringify(answers);
  const list = getResults();

  const same = list.findIndex((r) => JSON.stringify(r.answers) === key);
  const entry = {
    id: same >= 0 ? list[same].id : newId(),
    answers,
    includeC: !!includeC,
    top: top || null,
    count: count || 0,
    at: Date.now(),
  };

  if (same >= 0) list.splice(same, 1);
  list.unshift(entry);
  write(K_RESULTS, list.slice(0, MAX_KEEP));
  return entry.id;
}

export function getResults() {
  const raw = read(K_RESULTS);
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const list = raw.filter(
    (r) => r && r.id && r.answers && typeof r.answers === "object" && r.at && now - r.at < TTL
  );
  if (list.length !== raw.length) write(K_RESULTS, list);
  return list;
}

export function getResult(id) {
  const list = getResults();
  if (!id) return list[0] || null;
  return list.find((r) => r.id === id) || null;
}

export function clearResults() {
  drop(K_RESULTS);
}

/* ── 方剂库筛选状态 ───────────────────────────────────── */

export function saveLib(state) {
  write(K_LIB, { q: state.q || "", ch: state.ch || "", pat: state.pat || "", risk: state.risk || "" });
}

export function getLib() {
  const s = read(K_LIB);
  if (!s || typeof s !== "object") return { q: "", ch: "", pat: "", risk: "" };
  return { q: s.q || "", ch: s.ch || "", pat: s.pat || "", risk: s.risk || "" };
}

/* ── 时间描述 ─────────────────────────────────────────── */

export function timeAgo(ts) {
  if (!ts) return "";
  const d = Date.now() - ts;
  if (d < 60e3) return "刚刚";
  if (d < 3600e3) return `${Math.floor(d / 60e3)} 分钟前`;
  if (d < 864e5) return `${Math.floor(d / 3600e3)} 小时前`;
  if (d < 30 * 864e5) return `${Math.floor(d / 864e5)} 天前`;
  const dt = new Date(ts);
  return `${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
}

export function timeFull(ts) {
  if (!ts) return "";
  const dt = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
