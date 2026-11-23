// 视图渲染
import { symptomName, patternName, filterRecipes } from "./data.js";
import { buildQuestions, recommend, patternScores, PATTERN_INFO, RED_FLAGS, hasRedFlag, encodeAnswers } from "./quiz.js";

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const RISK_LABEL = { A: "甲 · 药食同源", B: "乙 · 含中药材", C: "丙 · 仅知识条目" };

const RISK_MARK = { A: "甲", B: "乙", C: "丙" };

function riskBadge(level) {
  const l = level || "B";
  return `<span class="risk risk-${l}" title="${RISK_LABEL[l]}">${RISK_MARK[l]}</span>`;
}

function seal(text) {
  return `<span class="seal">${[...text].map((c) => `<i>${c}</i>`).join("")}</span>`;
}

/* 按成分推出的偏性与注意事项（见 tools/herb-safety.json） */
function contraBlock(data, r) {
  const c = r.contra;
  if (!c || !c.classes?.length) {
    return `<div class="field muted"><dt>偏性</dt><dd style="color:var(--ink-3)">
      原料中未识别出需要提示偏性的药材。</dd></div>`;
  }
  const cls = c.classes.map((k) => ({ k, ...(data.contraClasses[k] || {}) })).filter((x) => x.label);
  const auds = (c.audiences || []).map((a) => data.audienceMap.get(a)).filter(Boolean);
  return `<div class="field"><dt>偏性</dt><dd>
    <div class="tagset" style="margin:0 0 .7rem">
      ${cls.map((x) => `<span class="ptag">${esc(x.label)}</span>`).join("")}
    </div>
    <ul class="contra">
      ${cls.map((x) => `<li><em>${esc(x.label)}</em>${esc(x.text)}</li>`).join("")}
      ${(c.notes || []).map((n) => `<li><em>${esc(n.herb)}</em>${esc(n.note)}</li>`).join("")}
    </ul>
    ${auds.length ? `<p class="contra-aud">需留意：${auds.map((a) => esc(a.label)).join("；")}。</p>` : ""}
    <p class="contra-src">本栏由 <code>tools/herb-safety.json</code> 按原料成分推出，非原书文字，也不能替代医师对该个体的判断。</p>
  </dd></div>`;
}

/* ── 首页 ───────────────────────────────────────────────────────────── */

export function renderHome(root, data) {
  const total = data.recipes.length;
  const aCount = data.recipes.filter((r) => r.risk?.level === "A").length;
  const caution = data.recipes.filter((r) => r.contra?.classes?.length).length;

  root.innerHTML = `
  <section class="hero">
    <p class="eyebrow">中医食养 · 方剂整理</p>
    <h1>食养方剂</h1>
    <p class="lead">一册民间食疗汤方，十四类、二百八十一方。<br>
    按症状圈定范围，按寒热虚实收窄，给出可参考的几条，而不是一个答案。</p>
    <div class="stamp seal" aria-hidden="true"><i>研</i><i>学</i></div>
    <div class="ornament"><span>开卷</span></div>
    <div class="btn-actions" style="justify-content:center">
      <a class="btn btn-primary" href="#/quiz">开始自测</a>
      <a class="btn" href="#/library">翻方剂库</a>
    </div>
  </section>

  <section class="entries">
    <a class="entry" href="#/quiz">
      <span class="num">其一</span>
      <h3>自测向导</h3>
      <p>先问四道客观症状，再问六道寒热虚实，末了得到两三个证型倾向与几条候选。全程在本机计算。</p>
    </a>
    <a class="entry" href="#/library">
      <span class="num">其二</span>
      <h3>方剂库</h3>
      <p>二百八十一方可按章节、证型、风险层级与关键词检索，每方附原文、页码与用药提示。</p>
    </a>
    <a class="entry" href="#/about">
      <span class="num">其三</span>
      <h3>凡例</h3>
      <p>数据从哪来、分类怎么做、哪些地方没做好。先看这一页，再决定要不要信这份东西。</p>
    </a>
  </section>

  <div class="ledger">
    <div><b>${total}</b><span>方剂</span></div>
    <div><b>${data.chapters.length}</b><span>门类</span></div>
    <div><b>${aCount}</b><span>药食同源</span></div>
    <div><b>${caution}</b><span>附偏性提示</span></div>
  </div>

  <p class="notice plain" style="margin-top:2rem">
    <strong>先说清楚：</strong>中医辨证要望闻问切，舌象与脉象问卷取不到。这里的「倾向」只是把二百八十一方缩小到几条的检索办法，
    不是诊断，也不该照着网页自己抓药。身体不适，请就医。
  </p>`;
}

/* ── 自测 ───────────────────────────────────────────────────────────── */

export function renderGate(root, state) {
  root.innerHTML = `
  <div class="quiz-shell">
    <div class="q-card">
      <p class="q-part">问诊之前</p>
      <h2 class="q-title">先确认几件要紧的事</h2>
      <p class="q-hint">以下情况只要有一项符合，就不适合在这里翻方子，应尽快就医。都不符合，可直接往下。</p>
      <div class="opts" data-flags>
        ${RED_FLAGS.map(
          (f) => `<label class="opt" data-flag="${f.id}">
            <input type="checkbox" value="${f.id}">
            <span class="mark"></span>
            <span>${esc(f.label)}</span>
          </label>`
        ).join("")}
        <label class="opt" data-flag="none">
          <input type="checkbox" value="none">
          <span class="mark"></span>
          <span>以上都没有</span>
        </label>
      </div>
      <div class="btn-actions">
        <button class="btn btn-primary" data-act="gate-next" disabled>继续</button>
        <a class="btn btn-ghost" href="#/">先不测了</a>
      </div>
      <p class="notice plain" style="margin-top:1.4rem;font-size:.78rem">
        本页只做知识整理与自测参考，不构成医疗建议。所有作答只在你的浏览器里计算，不会上传、不做统计。
      </p>
    </div>
  </div>`;

  const next = root.querySelector('[data-act="gate-next"]');
  const boxes = [...root.querySelectorAll("[data-flags] input")];
  const sync = () => {
    const chosen = boxes.filter((b) => b.checked).map((b) => b.value);
    // 「以上都没有」与其他互斥
    if (chosen.includes("none") && chosen.length > 1) {
      const last = document.activeElement?.value;
      boxes.forEach((b) => {
        if (b.value !== last) b.checked = false;
      });
    }
    root.querySelectorAll("[data-flag]").forEach((l) => {
      l.classList.toggle("is-on", l.querySelector("input").checked);
    });
    next.disabled = !boxes.some((b) => b.checked);
  };
  boxes.forEach((b) => b.addEventListener("change", sync));
}

export function renderQuestion(root, data, state) {
  const questions = buildQuestions(data);
  const q = questions[state.step];
  const total = questions.length;
  const answers = state.answers;
  const picked = answers[q.id];
  const pickedArr = Array.isArray(picked) ? picked : picked ? [picked] : [];
  const isMulti = q.type === "multi";
  const partLabel = q.part === 1 ? "第一层 · 客观症状" : "第二层 · 寒热虚实";

  root.innerHTML = `
  <div class="quiz-shell">
    <div class="q-progress">
      <span class="q-count">第 ${["一","二","三","四","五","六","七","八","九","十"][state.step] || state.step + 1} 问</span>
      <div class="q-bar"><span style="width:${((state.step + 1) / total) * 100}%"></span></div>
      <span class="q-count">共 ${total} 问</span>
    </div>
    <div class="q-card">
      <p class="q-part">${partLabel}</p>
      <h2 class="q-title">${esc(q.title)}</h2>
      ${q.hint ? `<p class="q-hint">${esc(q.hint)}</p>` : ""}
      <div class="opts${q.options.length > 8 ? " cols" : ""}">
        ${q.options
          .map(
            (o) => `<label class="opt${pickedArr.includes(o.id) ? " is-on" : ""}" data-opt="${o.id}">
              <input type="${isMulti ? "checkbox" : "radio"}" name="${q.id}" value="${o.id}" ${pickedArr.includes(o.id) ? "checked" : ""}>
              <span class="mark${isMulti ? "" : " rnd"}"></span>
              <span>${esc(o.label)}</span>
            </label>`
          )
          .join("")}
      </div>
      <div class="btn-actions">
        <button class="btn btn-primary" data-act="next" ${pickedArr.length ? "" : "disabled"}>
          ${state.step === total - 1 ? "看结果" : "下一问"}
        </button>
        ${state.step > 0 ? `<button class="btn btn-ghost" data-act="back">上一问</button>` : `<a class="btn btn-ghost" href="#/">退出</a>`}
        ${q.optional && !pickedArr.length ? `<button class="btn btn-ghost" data-act="skip">跳过这一问</button>` : ""}
      </div>
    </div>
  </div>`;

  root.querySelectorAll("[data-opt] input").forEach((inp) => {
    inp.addEventListener("change", () => {
      const val = inp.value;
      if (isMulti) {
        const cur = new Set(Array.isArray(answers[q.id]) ? answers[q.id] : []);
        inp.checked ? cur.add(val) : cur.delete(val);
        answers[q.id] = [...cur];
      } else {
        answers[q.id] = val;
      }
      root.querySelectorAll("[data-opt]").forEach((l) => {
        l.classList.toggle("is-on", l.querySelector("input").checked);
      });
      root.querySelector('[data-act="next"]').disabled = !(
        Array.isArray(answers[q.id]) ? answers[q.id].length : answers[q.id]
      );
    });
  });
}

/* ── 红旗页 ─────────────────────────────────────────────────────────── */

export function renderCare(root, flags = []) {
  const hit = RED_FLAGS.filter((f) => flags.includes(f.id));
  root.innerHTML = `
  <div class="quiz-shell">
    <div class="sheet" style="text-align:left">
      <p class="eyebrow">止步于此</p>
      <h2 class="sect-title" style="font-size:1.6rem;margin:.4rem 0 1rem">这些情况，先去看医生</h2>
      <p style="color:var(--ink-2)">你勾选了下面这<strong> ${hit.length} </strong>项。这一类情况需要面诊、查体与化验，
      不是食疗能处理的，也不该在这里翻方子。</p>
      <ul style="color:var(--ink);margin:.8rem 0 1.4rem;padding-left:1.2em">
        ${hit.map((f) => `<li>${esc(f.label)}</li>`).join("")}
      </ul>
      <div class="notice">
        <strong>建议：</strong>到正规医院的男科、泌尿外科或中医科就诊；血精、睾丸肿块、急性疼痛属于需要尽快排查的情况，不要拖。
        备孕一年未成功，建议夫妻双方同时检查。
      </div>
      <div class="btn-actions">
        <a class="btn btn-primary" href="#/">返回首页</a>
        <a class="btn btn-ghost" href="#/library">只翻方剂库</a>
      </div>
    </div>
  </div>`;
}

/* ── 结果页 ─────────────────────────────────────────────────────────── */

export function renderResult(root, data, answers, opts = {}) {
  const includeC = !!opts.includeC;
  const { list, patterns, total } = recommend(data, answers, { includeC, limit: 6 });

  if (!list.length) {
    root.innerHTML = `<div class="quiz-shell"><div class="sheet"><h2 class="sect-title">没有找到合适的条目</h2>
      <p style="color:var(--ink-2)">可能是症状标签缺失（约 4% 的方剂没有症状线索）。可以直接去方剂库按门类浏览。</p>
      <div class="btn-actions"><a class="btn btn-primary" href="#/library">翻方剂库</a><a class="btn btn-ghost" href="#/quiz">重新自测</a></div>
      </div></div>`;
    return;
  }

  const top = patterns.filter((p) => p.score > 0).slice(0, 2);
  const link = `#/result?a=${encodeAnswers(answers)}${includeC ? "&c=1" : ""}`;

  root.innerHTML = `
  <section class="prose" style="max-width:none">
    <p class="eyebrow">自测结果</p>
    <h1 class="sect-title" style="font-size:1.9rem;margin:.3rem 0 .2rem">证型倾向与候选</h1>
    <p style="color:var(--ink-3);font-size:.82rem">共 ${total} 条方剂与你的症状有重叠，下面按「症状 × 证型」排在前 ${list.length} 条。</p>
  </section>

  <div class="pattern-grid">
    ${top.length
      ? top
          .map((p, i) => `
      <div class="pattern-card${i === 0 ? " lead" : ""}">
        <span class="tag">${i === 0 ? "主要倾向" : "次要倾向"}</span>
        <h4>${esc(patternName(data, p.id))}</h4>
        <p>${esc(PATTERN_INFO[p.id]?.desc || "原文未细分证型。")}</p>
        <p class="caveat">${esc(PATTERN_INFO[p.id]?.caveat || "")}</p>
      </div>`).join("")
      : `<div class="pattern-card"><h4>证型线索不足</h4><p>你选的多为「都不明显 / 不清楚」，因此只能按症状匹配。可以回到第二层重填，或者直接浏览方剂库。</p></div>`}
  </div>

  <div class="sect-head" style="margin-top:2rem">
    <span class="sect-title" style="font-size:1.2rem">候选方剂</span>
    <span class="rule"></span>
    <span class="sect-note">按匹配度排序，非推荐顺序</span>
  </div>
  <p class="risk-legend">
    <span class="lg">风险分层</span>
    <span class="risk risk-A">甲</span><span class="lb">药食同源</span>
    <span class="risk risk-B">乙</span><span class="lb">含中药材，需辨证</span>
    <span class="risk risk-C">丙</span><span class="lb">仅知识条目</span>
  </p>

  <div class="cand-list">
    ${list
      .map(
        (c, i) => `
      <article class="cand">
        <span class="idx">${i + 1}</span>
        <div>
          <h4><a href="#/r/${c.recipe.id}">${esc(c.recipe.name)}</a></h4>
          <p class="why">
            命中症状：<em>${c.hitSymptoms.map((s) => esc(symptomName(data, s))).join("、") || "—"}</em>
            ${c.hitPatterns.length ? `　证型：<em>${c.hitPatterns.map((p) => esc(patternName(data, p))).join("、")}</em>${c.recipe.pattern_source === "inferred" ? "（据治法推断）" : ""}` : ""}
            ${c.recipe.patterns?.length ? "" : "　（原文未标证型）"}
          </p>
          ${
            c.conflicts.length
              ? `<p class="conflict">与你的情况可能相冲：${
                  c.conflicts.map((a) => esc(data.audienceMap.get(a)?.label || a)).join("；")
                }　<small>已据此降序</small></p>`
              : ""
          }
          <p class="eff">${esc(c.recipe.effect)}</p>
          <div class="tagset">
            ${(c.recipe.risk?.tags || []).map((t) => `<span>${esc(t)}</span>`).join("")}
            <span>原书 p.${c.recipe.page}</span>
          </div>
        </div>
        <div class="side">
          ${riskBadge(c.recipe.risk?.level)}
          <div class="score-bar"><span style="width:${Math.round(c.score * 100)}%"></span></div>
        </div>
      </article>`
      )
      .join("")}
  </div>

  <div class="notice" style="margin-top:1.8rem">
    <strong>这份结果能做什么、不能做什么：</strong>它把二百八十一方收窄到几条，并给出每条被选中的依据，方便你对照原文判断是否对症。
    它<strong>不能</strong>替代望闻问切——舌苔厚薄、脉象虚实、病程长短，问卷都取不到。凡含中药材（乙层）者，请由中医师看过再用；
    丙层条目只作知识展示，不提供操作指引。
  </div>

  <div class="btn-actions">
    <a class="btn btn-primary" href="#/quiz">重新自测</a>
    <a class="btn" href="${link}" data-act="share">复制分享链接</a>
    <button class="btn btn-ghost" data-act="toggle-c">${includeC ? "隐藏丙层条目" : "包含丙层条目（仅知识展示）"}</button>
  </div>`;
}

/* ── 方剂库 ─────────────────────────────────────────────────────────── */

const PAGE = 40;

export function renderLibrary(root, data, params) {
  const state = {
    q: params.get("q") || "",
    ch: params.get("ch") || "",
    pat: params.get("pat") || "",
    risk: params.get("risk") || "",
    shown: PAGE,
  };

  root.innerHTML = `
  <div class="sect-head">
    <span class="eyebrow" style="letter-spacing:.3em">方剂库</span>
    <span class="sect-title">二百八十一方</span>
    <span class="rule"></span>
    <span class="sect-note">按门类、证型、风险层级检索</span>
  </div>

  <div class="lib-tools">
    <div class="search">
      <input type="search" placeholder="搜方名、药材、功效，例如：菟丝子 / 腰痛 / 温肾" data-q value="${esc(state.q)}">
    </div>
    <div class="selects">
      <select data-ch>
        <option value="">全部门类</option>
        ${data.chapters.map((c) => `<option value="${esc(c)}" ${c === state.ch ? "selected" : ""}>${esc(c)}</option>`).join("")}
      </select>
      <select data-pat>
        <option value="">全部证型</option>
        ${data.patterns.map((p) => `<option value="${p.id}" ${p.id === state.pat ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
      </select>
    </div>
  </div>

  <div class="chips" data-risk>
    ${[
      ["", "全部层级"],
      ["A", "甲 · 药食同源"],
      ["B", "乙 · 含中药材"],
      ["C", "丙 · 仅知识"],
    ]
      .map(([v, label]) => `<button class="chip${state.risk === v ? " on" : ""}" data-risk-val="${v}">${label}</button>`)
      .join("")}
  </div>

  <div class="lib-meta">
    <p data-count></p>
    <p data-hint style="font-size:.74rem"></p>
  </div>

  <div class="rows" data-rows></div>
  <div class="more" data-more></div>`;

  const rowsEl = root.querySelector("[data-rows]");
  const countEl = root.querySelector("[data-count]");
  const moreEl = root.querySelector("[data-more]");

  const paint = () => {
    const all = filterRecipes(data, {
      chapter: state.ch,
      pattern: state.pat,
      risk: state.risk,
      keyword: state.q,
    });
    countEl.textContent = `共 ${all.length} 条${state.shown < all.length ? `，显示前 ${state.shown} 条` : ""}`;
    root.querySelector("[data-hint]").textContent = state.q || state.ch || state.pat || state.risk ? "条件可叠加" : "点条目看原文";

    rowsEl.innerHTML = all.slice(0, state.shown).map(rowHTML).join("") ||
      `<p class="empty">没有匹配的条目</p>`;

    moreEl.innerHTML = all.length > state.shown
      ? `<button class="btn" data-act="more">再看 ${Math.min(PAGE, all.length - state.shown)} 条</button>`
      : "";

    rowsEl.querySelectorAll("[data-id]").forEach((el) =>
      el.addEventListener("click", () => (location.hash = `#/r/${el.dataset.id}`))
    );
    moreEl.querySelector("[data-act='more']")?.addEventListener("click", () => {
      state.shown += PAGE;
      paint();
    });
  };

  const rowHTML = (r) => `
    <div class="row" data-id="${r.id}">
      <span class="pg">p.${r.page}</span>
      <span class="nm">${esc(r.name)}<small>${esc(r.chapter_name)}${r.patterns?.length ? " · " + r.patterns.slice(0, 2).map((p) => patternName(data, p)).join("/") : ""}</small></span>
      <span class="rt">${riskBadge(r.risk?.level)}</span>
    </div>`;

  let timer;
  root.querySelector("[data-q]").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = e.target.value;
      state.shown = PAGE;
      paint();
    }, 160);
  });
  root.querySelector("[data-ch]").addEventListener("change", (e) => {
    state.ch = e.target.value; state.shown = PAGE; paint();
  });
  root.querySelector("[data-pat]").addEventListener("change", (e) => {
    state.pat = e.target.value; state.shown = PAGE; paint();
  });
  root.querySelectorAll("[data-risk-val]").forEach((b) =>
    b.addEventListener("click", () => {
      state.risk = b.dataset.riskVal;
      root.querySelectorAll("[data-risk-val]").forEach((x) => x.classList.toggle("on", x === b));
      state.shown = PAGE;
      paint();
    })
  );

  paint();
}

/* ── 方剂详情 ───────────────────────────────────────────────────────── */

export function renderRecipe(root, data, id) {
  const r = data.byId.get(Number(id));
  if (!r) {
    root.innerHTML = `<div class="sheet"><p class="empty">找不到这一条</p></div>`;
    return;
  }
  const level = r.risk?.level || "B";
  const hideMethod = level === "C";

  root.innerHTML = `
  <div class="sheet" style="position:relative">
    <span class="vlabel">方剂</span>
    <a class="btn btn-ghost" href="#/library" style="margin-bottom:1rem;padding-left:0">← 回方剂库</a>
    <header class="recipe-head">
      <h1>${esc(r.name)}</h1>
      <div class="recipe-meta">
        <span>${esc(r.chapter)}</span><span class="dot">·</span>
        <span>原书 p.${r.page}</span><span class="dot">·</span>
        ${riskBadge(level)}
        ${r.patterns?.length ? `<span class="dot">·</span><span>${r.patterns.map((p) => esc(patternName(data, p))).join("、")}</span>` : `<span class="dot">·</span><span>原文未标证型</span>`}
      </div>
      ${(r.risk?.tags || []).length ? `<div class="tagset">${r.risk.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    </header>

    <dl class="fields">
      <div class="field"><dt>原料</dt><dd>${esc(r.ingredients)}</dd></div>
      ${
        hideMethod
          ? `<div class="field"><dt>制作</dt><dd><div class="veil">
              <strong>本条目归入丙层。</strong>含毒性药材、动物药或药酒，只作知识条目展示，不提供操作指引。
              原文做法可点开查看，但请勿据此自制——此类方剂的炮制与用量需专业处理。
              <div><button class="btn" data-act="reveal">仍要查看原文制法</button></div>
            </div><div data-method hidden>${esc(r.method)}</div></dd></div>`
          : `<div class="field"><dt>制作</dt><dd>${esc(r.method)}</dd></div>`
      }
      <div class="field muted"><dt>用法</dt><dd>${esc(r.usage)}</dd></div>
      <div class="field"><dt>功效</dt><dd>${esc(r.effect)}</dd></div>
      ${
        r.caution
          ? `<div class="field"><dt>宜忌</dt><dd>${esc(r.caution)}</dd></div>`
          : `<div class="field muted"><dt>宜忌</dt><dd style="color:var(--ink-3)">原文未载禁忌。含中药材者，请由中医师看过再用。</dd></div>`
      }
      ${contraBlock(data, r)}
    </dl>

    <div class="notice" style="margin-top:2rem">
      <strong>${RISK_LABEL[level]}。</strong>
      ${
        level === "A"
          ? "本方以药食同源之品为主，可作为日常饮食参考；但「适量」仍因人而异，体质偏颇者仍需辨证。"
          : level === "B"
          ? "本方含中药材，属「药膳」而非普通饮食。中药材有偏性，证型不符会适得其反，请由中医师确认后再用。"
          : "本方含毒性药材、动物药或药酒，仅在知识层面展示，不建议自行制作或服用。"
      }
    </div>

    <div class="btn-actions">
      <a class="btn btn-ghost" href="#/library">继续浏览</a>
      <a class="btn btn-ghost" href="#/quiz">用自测找方</a>
    </div>
  </div>`;

  root.querySelector("[data-act='reveal']")?.addEventListener("click", (e) => {
    const box = root.querySelector("[data-method]");
    box.hidden = false;
    e.target.parentElement.remove();
  });
}

/* ── 凡例 ───────────────────────────────────────────────────────────── */

export function renderAbout(root, data) {
  const noPattern = data.recipes.filter((r) => !r.patterns?.length).length;
  const inferred = data.recipes.filter((r) => r.pattern_source === "inferred").length;
  const noCaution = data.recipes.filter((r) => !r.caution).length;
  const noSym = data.recipes.filter((r) => !r.symptoms?.length).length;
  const hasContra = data.recipes.filter((r) => r.contra?.classes?.length).length;
  const audCount = data.audiences.length;

  root.innerHTML = `
  <div class="sheet" style="position:relative">
    <span class="vlabel">凡例</span>
    <section class="prose">
      <p class="eyebrow">凡例</p>
      <h1 class="sect-title" style="font-size:1.7rem;margin:.3rem 0 1.2rem">这份数据是怎么来的</h1>

      <p>底本是一册民间食疗汤方，共 <strong>${data.chapters.length} 类 ${data.recipes.length} 方</strong>，分为十四门：
      阳痿、遗精、早泄、肾虚腰痛、性功能减退、精液异常、不育、早衰、更年期、房劳过度、睾丸发育不良、阴茎短小、不射精、睾丸炎。
      每方原本只有「原料 / 制作 / 用法 / 功效 / 宜忌」五栏。</p>

      <h2>一、整理过程</h2>
      <ul>
        <li>原书扫描件的文本层里，数字与标点被替换成了替换字形，机器直接抽取会得到 <code>#对$</code> 这类乱码。</li>
        <li>因汉字正确、数字不可恢复，改为<strong>按页面图像逐页重录</strong>，再用文本层的汉字序列做交叉校验（平均相似度 99.7%）。</li>
        <li>重录后按固定结构切分为字段，剔除页眉、页码与水印。</li>
      </ul>

      <h2>二、派生字段</h2>
      <p>原书只有五个字段，检索所需的三样是后加的：</p>
      <table class="kv">
        <tr><th>字段</th><th>做法</th><th>可靠度</th></tr>
        <tr><td>症状标签</td><td>从「适用于……」句式用关键词表抽取</td><td>较高，${noSym} 条为空</td></tr>
        <tr><td>证型标签</td><td>从功效文字中的「肾阳虚 / 阴虚 / 湿热」等词判定；原文没写的，按治法词兜底推断</td><td>原文 ${data.recipes.length - noPattern - inferred} 条、推断 ${inferred} 条、仍缺 ${noPattern} 条</td></tr>
        <tr><td>风险层级</td><td>按药材目录判：甲 药食同源、乙 含中药材、丙 毒性药 / 动物药 / 药酒</td><td>规则判定，非临床评估</td></tr>
        <tr><td>原文宜忌</td><td>照抄原书「宜忌」栏</td><td>仅 ${data.recipes.length - noCaution} 条有，${noCaution} 条空缺</td></tr>
        <tr><td>偏性与注意</td><td>按原料成分查 <code>tools/herb-safety.json</code>（${audCount} 类需留意人群）推出</td><td>覆盖 ${hasContra} 条，规则性提示，非临床禁忌</td></tr>
      </table>

      <h2>三、为什么不是「一个症状一个方」</h2>
      <p>原书从不说明同一症状下几十个方该怎么挑。实测：功效覆盖两个以上症状的方占六成；
      阳痿一章仅 41 方，却有一百多个方的功效里提到阳痿。所以「症状 → 唯一答案」在数据上立不住。</p>
      <p>本站在做的，是<strong>把范围收窄并给出依据</strong>：症状圈定池子，寒热虚实再排一次序，最后把每条为什么被选中摊开给你看。
      选不选、用不用，仍要由人或医师判断。</p>

      <h2>四、明确做不到的</h2>
      <ul>
        <li>没有舌象、脉象、问诊细节，证型判断只到「倾向」。</li>
        <li>原书禁忌严重缺失（只有 ${data.recipes.length - noCaution} / ${data.recipes.length} 条），现由成分规则补齐 ${hasContra} 条，
        但规则只认药材偏性，认不出炮制差异、个体过敏与合并用药。</li>
        <li>不判断药物相互作用，不判断与西药同服的禁忌。</li>
        <li>不提供剂量换算、不提供采购与炮制指引。</li>
      </ul>

      <h2>五、免责</h2>
      <p><strong>本站为中医药膳知识的整理与学习项目，不构成医疗建议，不能替代面诊。</strong>
      页面中所有「倾向」「候选」均为检索排序结果，不是诊断结论，也不是用药推荐。
      身体不适、症状持续或加重，请及时就医。</p>

      <h2>六、偏性判定怎么用</h2>
      <p>结果页会把「你的寒热虚实」与「方子的偏性」对一遍：偏温燥的方遇到口干、潮热、舌红少苔的作答，会标注「可能相冲」并降序，
      但<strong>不会静默剔除</strong>——因为问卷只有十题，判错的时候需要你看得见原因，而不是被我藏起来。</p>

      <h2>七、本地运行</h2>
      <p>纯静态站点，无构建、无依赖、无后端，作答全部在浏览器内计算。克隆后起一个静态服务即可：</p>
      <p><code>python -m http.server 8000</code> &nbsp;然后访问 <code>http://localhost:8000</code>。</p>
    </section>
  </div>`;
}
