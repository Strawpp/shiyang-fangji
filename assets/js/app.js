// 路由与交互装配
import { loadData } from "./data.js";
import { renderHome, renderGate, renderQuestion, renderCare, renderResult, renderLibrary, renderRecipe, renderAbout } from "./ui.js";
import { buildQuestions, encodeAnswers, decodeAnswers, hasRedFlag } from "./quiz.js";

const app = document.getElementById("app");
let DATA = null;

const quiz = {
  phase: "gate",
  step: 0,
  flags: [],
  answers: {},
};
let lastPath = null;

function setNav(route) {
  document.querySelectorAll("#nav a").forEach((a) => {
    const key = a.dataset.nav;
    const on =
      (key === "quiz" && (route.startsWith("/quiz") || route.startsWith("/care") || route.startsWith("/result"))) ||
      (key === "library" && (route.startsWith("/library") || route.startsWith("/r/"))) ||
      (key === "about" && route.startsWith("/about"));
    a.classList.toggle("is-active", on);
  });
}

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path, params: new URLSearchParams(query) };
}

function render() {
  const { path, params } = parseHash();
  setNav(path);

  // 从别的页面进入自测：重置进度（否则会停在上次结束的那一题）
  if (path === "/quiz" && lastPath && lastPath !== "/quiz") {
    quiz.step = 0;
    quiz.answers = {};
    quiz.phase = sessionStorage.getItem("gate-passed") ? "q" : "gate";
  }
  lastPath = path;
  app.innerHTML = "";
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

  if (path === "/" || path === "") {
    renderHome(app, DATA);
    return;
  }

  if (path === "/quiz") {
    if (quiz.phase === "gate" && !sessionStorage.getItem("gate-passed")) {
      renderGate(app, quiz);
      app.querySelector('[data-act="gate-next"]').addEventListener("click", () => {
        const flags = [...app.querySelectorAll("[data-flags] input:checked")].map((b) => b.value);
        quiz.flags = flags;
        if (hasRedFlag(flags)) {
          location.hash = `#/care?f=${flags.join(",")}`;
          return;
        }
        sessionStorage.setItem("gate-passed", "1");
        quiz.phase = "q";
        quiz.step = 0;
        quiz.answers = {};
        render();
      });
      return;
    }
    if (!sessionStorage.getItem("gate-passed")) {
      quiz.phase = "gate";
      render();
      return;
    }
    quiz.phase = "q";
    renderQuestion(app, DATA, quiz);
    bindQuestion();
    return;
  }

  if (path === "/care") {
    const flags = (params.get("f") || "").split(",").filter(Boolean);
    renderCare(app, flags);
    return;
  }

  if (path === "/result") {
    const answers = decodeAnswers(params.get("a") || "");
    if (!answers) {
      location.hash = "#/quiz";
      return;
    }
    renderResult(app, DATA, answers, { includeC: params.get("c") === "1" });
    app.querySelector('[data-act="share"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const url = location.href;
      navigator.clipboard?.writeText(url).then(
        () => (e.target.textContent = "链接已复制"),
        () => (e.target.textContent = "复制失败，可手动复制地址栏")
      );
    });
    app.querySelector('[data-act="toggle-c"]')?.addEventListener("click", () => {
      const next = new URLSearchParams(params);
      if (next.get("c") === "1") next.delete("c");
      else next.set("c", "1");
      location.hash = `#/result?${next.toString()}`;
    });
    return;
  }

  if (path === "/library") {
    renderLibrary(app, DATA, params);
    return;
  }

  if (path.startsWith("/r/")) {
    renderRecipe(app, DATA, path.slice(3));
    return;
  }

  if (path === "/about") {
    renderAbout(app, DATA);
    return;
  }

  renderHome(app, DATA);
}

function bindQuestion() {
  const questions = buildQuestions(DATA);
  const nextBtn = app.querySelector('[data-act="next"]');
  const backBtn = app.querySelector('[data-act="back"]');
  const skipBtn = app.querySelector('[data-act="skip"]');

  nextBtn?.addEventListener("click", () => {
    if (quiz.step >= questions.length - 1) {
      location.hash = `#/result?a=${encodeAnswers(quiz.answers)}`;
      return;
    }
    quiz.step += 1;
    render();
  });

  backBtn?.addEventListener("click", () => {
    quiz.step = Math.max(0, quiz.step - 1);
    render();
  });

  skipBtn?.addEventListener("click", () => {
    const q = questions[quiz.step];
    quiz.answers[q.id] = [];
    quiz.step += 1;
    render();
  });
}

window.addEventListener("hashchange", render);

(async function boot() {
  try {
    DATA = await loadData();
    render();
  } catch (err) {
    app.innerHTML = `<div class="sheet"><h2 class="sect-title">数据没能打开</h2>
      <p style="color:var(--ink-2)">${String(err.message || err)}</p>
      <p style="color:var(--ink-3);font-size:.84rem">若是直接双击 HTML 打开，浏览器会拦截本地文件读取。请在项目目录运行 <code>python -m http.server 8000</code> 后访问 localhost。</p></div>`;
  }
})();
