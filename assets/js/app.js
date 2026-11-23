// 路由与装配
import { loadData } from "./data.js";
import * as V from "./ui.js";
import { decodeAnswers, hasRedFlag } from "./quiz.js";
import { getResults, getResult, saveResult, getLib, saveLib, clearResults } from "./store.js";

const app = document.getElementById("app");
let DATA = null;

// 自测会话：只在本次标签页内保留，刷新不丢，关掉就没了
const QUIZ_KEY = "sf.quiz.v2";
const GATE_KEY = "sf.gate.v2";

const quiz = { phase: "gate", step: 0, flags: [], answers: {} };

function loadQuiz() {
  try {
    const s = JSON.parse(sessionStorage.getItem(QUIZ_KEY) || "null");
    if (s && typeof s === "object") Object.assign(quiz, s);
  } catch {
    /* 忽略 */
  }
}

function saveQuiz() {
  try {
    sessionStorage.setItem(QUIZ_KEY, JSON.stringify({ ...quiz }));
  } catch {
    /* 忽略 */
  }
}

function resetQuiz() {
  quiz.phase = sessionStorage.getItem(GATE_KEY) ? "q" : "gate";
  quiz.step = 0;
  quiz.flags = [];
  quiz.answers = {};
  saveQuiz();
}

/* ── 路由 ─────────────────────────────────────────────── */

let prevPath = null; // 进入当前页之前所在的路径，用于「返回」判定
let pending = null; // 刚做完、尚未落盘的结果（结果页渲染完才写本地）
let libScroll = null; // 从方剂库进入详情时记下位置，回来时还原

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(query) };
}

function go(hash, { replace = false } = {}) {
  if (!replace) {
    location.hash = hash;
    return;
  }
  // 替换当前历史条目：浏览器的返回不会退回上一题
  history.replaceState(null, "", hash);
  render();
}

function setNav(path) {
  const hasHistory = getResults().length > 0;
  document.querySelectorAll("#nav a").forEach((a) => {
    const key = a.dataset.nav;
    // 有记录时才露出「记录」入口，首次来访不占位置
    if (key === "history") a.hidden = !hasHistory;
    const on =
      (key === "quiz" && /^\/(quiz|care|result)/.test(path)) ||
      (key === "library" && /^\/(library|r\/)/.test(path)) ||
      (key === "history" && path.startsWith("/history")) ||
      (key === "about" && path.startsWith("/about"));
    a.classList.toggle("is-active", on);
    a.setAttribute("aria-current", on ? "page" : "false");
  });
}

function useLibDefaults(params) {
  const hasParam = ["q", "ch", "pat", "risk"].some((k) => params.has(k));
  if (hasParam) {
    return {
      q: params.get("q") || "",
      ch: params.get("ch") || "",
      pat: params.get("pat") || "",
      risk: params.get("risk") || "",
    };
  }
  return getLib();
}

function render() {
  const { path, params } = parseHash();
  const fromPath = prevPath;
  prevPath = path;

  setNav(path);

  // 除方剂库回退外，一律回到页首
  if (!(path === "/library" && libScroll != null)) window.scrollTo({ top: 0, behavior: "instant" });

  app.innerHTML = "";

  if (path === "/") {
    const list = getResults();
    V.home(app, DATA, { last: list[0] || null, count: list.length });
    return;
  }

  if (path === "/quiz") {
    if (params.get("new") === "1") {
      resetQuiz();
      history.replaceState(null, "", "#/quiz");
    }
    renderQuiz();
    return;
  }

  if (path === "/care") {
    V.care(app, (params.get("f") || "").split(",").filter(Boolean));
    return;
  }

  if (path === "/result") {
    const shared = params.get("a");
    const historyId = params.get("h");
    const record = historyId ? getResult(historyId) : shared ? null : pending || getResult();
    const answers = shared ? decodeAnswers(shared) : record?.answers || null;
    const includeC = params.get("c") === "1" || (!shared && !!record?.includeC);

    if (!answers) {
      go("#/quiz", { replace: true });
      return;
    }

    const base = shared ? { a: shared } : historyId ? { h: historyId } : {};
    const summary = V.result(app, DATA, answers, {
      includeC,
      savedAt: shared ? null : record?.at || null,
      onToggleC: () => {
        const next = new URLSearchParams(base);
        if (!includeC) next.set("c", "1");
        const qs = next.toString();
        go(`#/result${qs ? "?" + qs : ""}`, { replace: true });
      },
    });

    // 新做的结果才落盘；分享链接与历史回看都不覆盖
    if (summary && !shared && !historyId) {
      saveResult({ answers, includeC, ...summary });
      pending = null;
    }
    return;
  }

  if (path === "/history") {
    const list = getResults();
    V.history(app, DATA, list, {
      onClear: () => {
        clearResults();
        render();
      },
    });
    return;
  }

  if (path === "/library") {
    const state = useLibDefaults(params);
    V.library(app, DATA, state, {
      onChange: (s) => {
        saveLib(s);
        const qs = new URLSearchParams();
        Object.entries(s).forEach(([k, v]) => v && qs.set(k, v));
        const h = `#/library${qs.toString() ? "?" + qs : ""}`;
        if (location.hash !== h) history.replaceState(null, "", h);
      },
      onOpen: (id) => {
        libScroll = window.scrollY;
        go(`#/r/${id}?from=library`);
      },
      restoreScroll: libScroll,
    });
    libScroll = null;
    return;
  }

  if (path.startsWith("/r/")) {
    const from =
      fromPath && fromPath.startsWith("/result")
        ? "result"
        : fromPath && fromPath.startsWith("/library")
        ? "library"
        : params.get("from") || "library";
    V.recipe(app, DATA, path.slice(3), {
      from,
      onBack: () => {
        if (fromPath) history.back();
        else go(from === "result" ? "#/result" : "#/library");
      },
    });
    return;
  }

  if (path === "/about") {
    V.about(app, DATA);
    return;
  }

  const list = getResults();
  V.home(app, DATA, { last: list[0] || null, count: list.length });
}

/* ── 自测流程 ─────────────────────────────────────────── */

function renderQuiz() {
  if (quiz.phase === "gate" && !sessionStorage.getItem(GATE_KEY)) {
    V.gate(app, {
      onSubmit: (flags) => {
        quiz.flags = flags;
        if (hasRedFlag(flags)) {
          go(`#/care?f=${flags.join(",")}`);
          return;
        }
        try {
          sessionStorage.setItem(GATE_KEY, "1");
        } catch {
          /* 忽略 */
        }
        quiz.phase = "q";
        quiz.step = 0;
        quiz.answers = {};
        saveQuiz();
        render();
      },
    });
    return;
  }

  quiz.phase = "q";
  const total = V.questionCount(DATA);
  if (quiz.step >= total) quiz.step = 0;

  V.question(app, DATA, quiz, {
    onNext: () => {
      const total = V.questionCount(DATA);
      if (quiz.step >= total - 1) {
        saveQuiz();
        pending = { answers: { ...quiz.answers }, includeC: false };
        // 交卷后清空会话，下次点「自测」从第一问开始
        quiz.step = 0;
        quiz.answers = {};
        saveQuiz();
        go("#/result", { replace: true });
        return;
      }
      quiz.step += 1;
      saveQuiz();
      render();
    },
    onBack: () => {
      quiz.step = Math.max(0, quiz.step - 1);
      saveQuiz();
      render();
    },
    onExit: () => {
      resetQuiz();
      go("#/");
    },
  });
}

window.addEventListener("hashchange", render);

(async function boot() {
  loadQuiz();
  try {
    DATA = await loadData();
    render();
  } catch (err) {
    app.innerHTML = `<div class="panel"><h2 class="h2">数据没能打开</h2>
      <p class="hint">${String(err.message || err)}</p>
      <p class="fine">若是直接双击 HTML 打开，浏览器会拦截本地文件读取。请在项目目录运行 <code>python -m http.server 8000</code> 后访问 localhost。</p></div>`;
  }
})();
