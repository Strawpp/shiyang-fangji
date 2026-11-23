// 视图渲染
import { symptomName, patternName, filterRecipes } from "./data.js";
import { buildQuestions, recommend, PATTERN_INFO, RED_FLAGS, encodeAnswers } from "./quiz.js";
import { timeAgo, timeFull } from "./store.js";

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const RISK = {
  A: { mark: "甲", label: "药食同源", hint: "以食材为主，可作日常饮食参考；「适量」仍因人而异。" },
  B: { mark: "乙", label: "含中药材", hint: "属药膳而非普通饮食。中药材有偏性，证型不符会适得其反，请由中医师确认后再用。" },
  C: { mark: "丙", label: "仅知识条目", hint: "含毒性药材、动物药或药酒，只在知识层面展示，不建议自行制作或服用。" },
};

const riskMark = (level) => {
  const l = RISK[level] ? level : "B";
  return `<span class="risk risk-${l}" title="${esc(RISK[l].label)}">${RISK[l].mark}</span>`;
};

const legend = `<p class="legend">
  <span class="lg">分层</span>
  ${riskMark("A")}<span>药食同源</span>
  ${riskMark("B")}<span>含中药材</span>
  ${riskMark("C")}<span>仅知识条目</span>
</p>`;

/* ── 首页 ─────────────────────────────────────────────── */

export function home(root, data, { last, count = 0 } = {}) {
  const contra = data.recipes.filter((r) => r.contra?.classes?.length).length;

  root.innerHTML = `
  <section class="hero">
    <h1 class="h1 hero-t">食养方剂</h1>
    <p class="hero-p">一册民间食疗汤方。先圈定症状范围，再按寒热虚实收窄，最后给出几条候选，以及选中它的理由。</p>
    <div class="act act-hero">
      <a class="btn btn-primary" href="#/quiz">开始自测</a>
      <a class="btn" href="#/library">翻方剂库</a>
    </div>
  </section>

  ${
    last
      ? `<a class="resume" href="#/result">
          <span class="resume-b">
            <span class="resume-l">上次结果</span>
            <span class="resume-m">${esc(last.top?.name || "自测已保存")}${
          last.count ? ` · ${last.count} 条候选` : ""
        }</span>
          </span>
          <span class="resume-t">${timeAgo(last.at)}</span>
          <span class="chev" aria-hidden="true"></span>
        </a>
        ${
          count > 1
            ? `<a class="more-link" href="#/history">历次自测 · 共 ${count} 次记录<span class="chev" aria-hidden="true"></span></a>`
            : ""
        }`
      : ""
  }

  <p class="facts">${data.recipes.length} 方 · ${data.chapters.length} 门 · ${contra} 附偏性提示</p>

  <details class="brief">
    <summary>这是什么，能做什么</summary>
    <div>
      <p>底本是一册民间食疗汤方，每方只有「原料 / 制作 / 用法 / 功效 / 宜忌」五栏。原书没有说同一症状下几十个方该怎么挑，
      所以这里不做「一症一方」，只做<strong>收窄范围</strong>：症状圈定池子，寒热虚实排一次序，再把每条为什么被选中摊开给你看。</p>
      <p>中医辨证要望闻问切，舌象与脉象问卷取不到。这里的「倾向」是检索结果，不是诊断，也不该照着网页自己抓药。身体不适，请就医。</p>
    </div>
  </details>

  <p class="fine" style="text-align:center">数据来源与已知局限，见 <a href="#/about">凡例</a>。</p>`;
}

/* ── 自测：筛查 ───────────────────────────────────────── */

export function gate(root, { onSubmit }) {
  root.innerHTML = `
  <div class="quiz">
    <div class="panel">
      <p class="kick">开始之前</p>
      <h2 class="h2">先确认几件要紧的事</h2>
      <p class="hint">下面这些情况，食疗帮不上忙，需要面诊与检查。有就勾上，没有就直接开始。</p>
      <div class="opts" data-flags>
        ${RED_FLAGS.map(
          (f) => `<label class="opt">
            <input type="checkbox" value="${f.id}">
            <span class="mark"></span>
            <span>${esc(f.label)}</span>
          </label>`
        ).join("")}
      </div>
      <div class="act">
        <button class="btn btn-primary btn-block" data-act="go">以上都没有，开始自测</button>
      </div>
      <p class="fine">本页只做知识整理与自测参考，不构成医疗建议。作答只在你的浏览器里计算，不会上传、不做统计。</p>
    </div>
  </div>`;

  const btn = root.querySelector('[data-act="go"]');
  const boxes = [...root.querySelectorAll("[data-flags] input")];

  const sync = () => {
    const n = boxes.filter((b) => b.checked).length;
    boxes.forEach((b) => b.closest(".opt").classList.toggle("is-on", b.checked));
    btn.textContent = n ? `我勾选了 ${n} 项，看看该怎么处理` : "以上都没有，开始自测";
    btn.classList.toggle("btn-primary", n === 0);
    btn.classList.toggle("btn-alert", n > 0);
  };
  boxes.forEach((b) => b.addEventListener("change", sync));

  btn.addEventListener("click", () => {
    onSubmit(boxes.filter((b) => b.checked).map((b) => b.value));
  });
}

/* ── 自测：题目 ───────────────────────────────────────── */

export function questionCount(data) {
  return buildQuestions(data).length;
}

const NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

export function question(root, data, state, { onNext, onBack, onExit }) {
  const questions = buildQuestions(data);
  const q = questions[state.step];
  const total = questions.length;
  const answers = state.answers;
  const picked = answers[q.id];
  const pickedArr = Array.isArray(picked) ? picked : picked ? [picked] : [];
  const isMulti = q.type === "multi";
  const last = state.step === total - 1;

  root.innerHTML = `
  <div class="quiz">
    <div class="qbar" role="progressbar" aria-valuenow="${state.step + 1}" aria-valuemin="1" aria-valuemax="${total}">
      <span style="width:${((state.step + 1) / total) * 100}%"></span>
    </div>
    <p class="qmeta">
      <span>第 ${NUM[state.step] || state.step + 1} 问 · 共 ${total} 问</span>
      <span>${q.part === 1 ? "客观症状" : "寒热虚实"}</span>
    </p>

    <div class="panel">
      <h2 class="h2">${esc(q.title)}</h2>
      ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ""}
      <div class="opts${q.options.length > 8 ? " cols" : ""}">
        ${q.options
          .map(
            (o) => `<label class="opt${pickedArr.includes(o.id) ? " is-on" : ""}">
              <input type="${isMulti ? "checkbox" : "radio"}" name="${q.id}" value="${o.id}" ${
              pickedArr.includes(o.id) ? "checked" : ""
            }>
              <span class="mark${isMulti ? "" : " rnd"}"></span>
              <span>${esc(o.label)}</span>
            </label>`
          )
          .join("")}
      </div>

      <div class="act">
        <button class="btn btn-primary btn-block" data-act="next" ${pickedArr.length ? "" : "disabled"}>
          ${last ? "看结果" : "下一问"}
        </button>
        ${
          state.step > 0
            ? `<button class="btn btn-text" data-act="back">上一问</button>`
            : `<button class="btn btn-text" data-act="exit">退出</button>`
        }
      </div>
      ${q.optional ? `<p class="fine">这一问可以跳过，不影响使用。</p>` : ""}
    </div>
  </div>`;

  const nextBtn = root.querySelector('[data-act="next"]');

  root.querySelectorAll(".opt input").forEach((inp) => {
    inp.addEventListener("change", () => {
      if (isMulti) {
        const cur = new Set(Array.isArray(answers[q.id]) ? answers[q.id] : []);
        inp.checked ? cur.add(inp.value) : cur.delete(inp.value);
        answers[q.id] = [...cur];
      } else {
        answers[q.id] = inp.value;
      }
      root.querySelectorAll(".opt").forEach((l) => l.classList.toggle("is-on", l.querySelector("input").checked));
      const v = answers[q.id];
      nextBtn.disabled = !(Array.isArray(v) ? v.length : v);
    });
  });

  nextBtn.addEventListener("click", onNext);
  root.querySelector('[data-act="back"]')?.addEventListener("click", onBack);
  root.querySelector('[data-act="exit"]')?.addEventListener("click", onExit);
}

/* ── 红旗页 ───────────────────────────────────────────── */

export function care(root, flags = []) {
  const hit = RED_FLAGS.filter((f) => flags.includes(f.id));
  root.innerHTML = `
  <div class="quiz">
    <div class="panel">
      <p class="kick">止步于此</p>
      <h2 class="h2">这些情况，先去看医生</h2>
      <p class="hint">你勾选了下面 ${hit.length} 项。这一类情况需要面诊、查体与化验，不是食疗能处理的，也不该在这里翻方子。</p>
      <ul class="hitlist">${hit.map((f) => `<li>${esc(f.label)}</li>`).join("")}</ul>
      <div class="notice">
        <strong>建议：</strong>到正规医院的男科、泌尿外科或中医科就诊。血精、睾丸肿块、急性疼痛属于需要尽快排查的情况，不要拖；
        备孕一年未成功，建议夫妻双方同时检查。
      </div>
      <div class="act">
        <a class="btn btn-primary btn-block" href="#/">返回首页</a>
        <a class="btn btn-text" href="#/library">只看方剂库</a>
      </div>
    </div>
  </div>`;
}

/* ── 结果页 ───────────────────────────────────────────── */

export function result(root, data, answers, opts = {}) {
  const { includeC = false, savedAt = null, onToggleC } = opts;
  const { list, patterns, total } = recommend(data, answers, { includeC, limit: 6 });

  if (!list.length) {
    root.innerHTML = `<div class="quiz"><div class="panel">
      <h2 class="h2">没有找到合适的条目</h2>
      <p class="hint">可能是症状标签缺失（约 4% 的方剂没有症状线索）。可以直接去方剂库按门类浏览。</p>
      <div class="act">
        <a class="btn btn-primary btn-block" href="#/library">翻方剂库</a>
        <a class="btn btn-text" href="#/quiz?new=1">重新自测</a>
      </div></div></div>`;
    return null;
  }

  const top = patterns.filter((p) => p.score > 0).slice(0, 2);
  const first = top[0];
  const info = first ? PATTERN_INFO[first.id] : null;

  root.innerHTML = `
  <header class="phead">
    <p class="kick">自测结果</p>
    <h1 class="h1">${first ? esc(patternName(data, first.id)) : "证型线索不足"}</h1>
    <p class="sub">${savedAt ? timeAgo(savedAt) + " · " : ""}${total} 条方剂与你的症状有重叠，下面取前 ${list.length} 条</p>
  </header>

  <div class="verdict">
    ${
      first
        ? `<p>${esc(info?.desc || "")}</p>
           <p class="cav">${esc(info?.caveat || "")}</p>
           ${top[1] ? `<p class="alt">次要倾向：${esc(patternName(data, top[1].id))}</p>` : ""}`
        : `<p>你选的多为「都不明显 / 不清楚」，因此只能按症状匹配。可以回到第二层重填，或者直接浏览方剂库。</p>`
    }
  </div>

  <h2 class="sh">候选方剂 <span>按匹配度排序，不是推荐顺序</span></h2>
  ${legend}

  <div class="cands">
    ${list
      .map((c) => {
        const why = [];
        const syms = c.hitSymptoms.map((s) => symptomName(data, s));
        if (syms.length) why.push(syms.length > 3 ? syms.slice(0, 3).join("、") + " 等" : syms.join("、"));

        return `<a class="cand" href="#/r/${c.recipe.id}?from=result">
          <div class="cand-b">
            <p class="cand-n">${esc(c.recipe.name)} ${riskMark(c.recipe.risk?.level)}</p>
            ${why.length ? `<p class="cand-w">命中 ${esc(why.join(" · "))}</p>` : `<p class="cand-w">原文未标证型</p>`}
            <p class="cand-e">${esc(c.recipe.effect)}</p>
            ${
              c.conflicts.length
                ? `<p class="cand-c">与你的情况可能相冲：${c.conflicts
                    .map((a) => esc(data.audienceMap.get(a)?.label || a))
                    .join("；")}　已据此降序</p>`
                : ""
            }
          </div>
          <span class="chev" aria-hidden="true"></span>
        </a>`;
      })
      .join("")}
  </div>

  <div class="act act-wide">
    <a class="btn" href="#/quiz?new=1">重新自测</a>
    <button class="btn" data-act="share">复制分享链接</button>
    <button class="btn btn-text" data-act="c">${includeC ? "隐藏丙层条目" : "带上丙层条目"}</button>
  </div>

  <div class="notice">
    这份结果把二百八十一方收窄到几条，并给出每条被选中的依据，方便你对照原文判断是否对症。
    它<strong>不能</strong>替代望闻问切——舌苔厚薄、脉象虚实、病程长短，问卷都取不到。含中药材者，请由中医师看过再用；丙层条目只作知识展示。
  </div>`;

  root.querySelector('[data-act="share"]').addEventListener("click", async (e) => {
    const url = `${location.origin}${location.pathname}#/result?a=${encodeAnswers(answers)}`;
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = "已复制";
    } catch {
      window.prompt("复制这个链接分享：", url);
    }
    setTimeout(() => (btn.textContent = "复制分享链接"), 1800);
  });

  root.querySelector('[data-act="c"]').addEventListener("click", onToggleC);

  return {
    top: first ? { id: first.id, name: patternName(data, first.id) } : null,
    count: list.length,
  };
}

/* ── 方剂库 ───────────────────────────────────────────── */

const PAGE = 40;

export function library(root, data, initial, { onChange, onOpen, restoreScroll }) {
  const state = { ...initial, shown: PAGE };

  root.innerHTML = `
  <div class="phead phead-lib">
    <p class="kick">方剂库</p>
    <h1 class="h1">${data.recipes.length} 方</h1>
  </div>

  <div class="tools">
    <input type="search" class="search" placeholder="搜方名、药材、功效" enterkeyhint="search" data-q value="${esc(state.q)}">
    <select data-ch aria-label="按门类筛选">
      <option value="">全部门类</option>
      ${data.chapters.map((c) => `<option value="${esc(c)}" ${c === state.ch ? "selected" : ""}>${esc(c)}</option>`).join("")}
    </select>
    <select data-pat aria-label="按证型筛选">
      <option value="">全部证型</option>
      ${data.patterns.map((p) => `<option value="${p.id}" ${p.id === state.pat ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
    </select>
  </div>

  <div class="chips" data-risk>
    ${[["", "全部"], ["A", "甲 药食同源"], ["B", "乙 含中药材"], ["C", "丙 仅知识"]]
      .map(([v, label]) => `<button class="chip${state.risk === v ? " on" : ""}" data-v="${v}">${label}</button>`)
      .join("")}
  </div>

  <p class="lib-meta" data-count></p>
  <div class="rows" data-rows></div>
  <div class="act" data-more></div>`;

  const rowsEl = root.querySelector("[data-rows]");
  const countEl = root.querySelector("[data-count]");
  const moreEl = root.querySelector("[data-more]");

  const rowHTML = (r) => `<a class="row" href="#/r/${r.id}?from=library" data-id="${r.id}">
      <span class="nm">${esc(r.name)}
        <small>${esc(r.chapter_name)}${
    r.patterns?.length ? " · " + r.patterns.slice(0, 2).map((p) => patternName(data, p)).join("/") : ""
  }</small>
      </span>
      <span class="rt">${riskMark(r.risk?.level)}</span>
      <span class="chev" aria-hidden="true"></span>
    </a>`;

  const paint = () => {
    const all = filterRecipes(data, { chapter: state.ch, pattern: state.pat, risk: state.risk, keyword: state.q });
    countEl.textContent = `${all.length} 条${state.shown < all.length ? `，已显示 ${state.shown}` : ""}`;
    rowsEl.innerHTML = all.slice(0, state.shown).map(rowHTML).join("") || `<p class="empty">没有匹配的条目</p>`;
    moreEl.innerHTML =
      all.length > state.shown
        ? `<button class="btn btn-block" data-act="more">再看 ${Math.min(PAGE, all.length - state.shown)} 条</button>`
        : "";
    moreEl.querySelector("[data-act='more']")?.addEventListener("click", () => {
      state.shown += PAGE;
      paint();
    });
    rowsEl.querySelectorAll(".row").forEach((el) => el.addEventListener("click", () => onOpen(el.dataset.id)));
  };

  let timer;
  root.querySelector("[data-q]").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = e.target.value.trim();
      state.shown = PAGE;
      paint();
      onChange(state);
    }, 180);
  });
  root.querySelector("[data-ch]").addEventListener("change", (e) => {
    state.ch = e.target.value;
    state.shown = PAGE;
    paint();
    onChange(state);
  });
  root.querySelector("[data-pat]").addEventListener("change", (e) => {
    state.pat = e.target.value;
    state.shown = PAGE;
    paint();
    onChange(state);
  });
  root.querySelectorAll("[data-v]").forEach((b) =>
    b.addEventListener("click", () => {
      state.risk = b.dataset.v;
      root.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("on", x === b));
      state.shown = PAGE;
      paint();
      onChange(state);
    })
  );

  paint();
  if (restoreScroll != null) requestAnimationFrame(() => window.scrollTo({ top: restoreScroll, behavior: "instant" }));
}

/* ── 方剂详情 ─────────────────────────────────────────── */

export function recipe(root, data, id, { from = "library", onBack } = {}) {
  const r = data.byId.get(Number(id));
  if (!r) {
    root.innerHTML = `<div class="panel"><p class="empty">找不到这一条</p>
      <div class="act"><a class="btn btn-block" href="#/library">回方剂库</a></div></div>`;
    return;
  }

  const level = r.risk?.level || "B";
  const hideMethod = level === "C";
  const backLabel = from === "result" ? "返回结果" : "返回方剂库";
  const backHref = from === "result" ? "#/result" : "#/library";

  const c = r.contra;
  const cls = (c?.classes || []).map((k) => ({ k, ...(data.contraClasses[k] || {}) })).filter((x) => x.label);
  const auds = (c?.audiences || []).map((a) => data.audienceMap.get(a)).filter(Boolean);

  const blk = (label, body, extra = "") => `<section class="blk${extra}">
      <h3>${label}</h3>
      <div class="blk-b">${body}</div>
    </section>`;

  root.innerHTML = `
  <a class="back" href="${backHref}" data-back>← ${backLabel}</a>

  <header class="phead">
    <h1 class="h1">${esc(r.name)}</h1>
    <p class="sub">${esc(r.chapter_name)} · 原书 p.${r.page} · ${riskMark(level)} · ${
      r.patterns?.length ? esc(r.patterns.map((p) => patternName(data, p)).join("、")) : "原文未标证型"
    }</p>
  </header>

  <div class="panel panel-doc">
    ${blk("原料", esc(r.ingredients))}
    ${blk(
      "制作",
      hideMethod
        ? `<div class="veil">
            <p><strong>本条目归入丙层。</strong>含毒性药材、动物药或药酒，只作知识条目展示，不提供操作指引。</p>
            <p>原文做法可展开查看，但请勿据此自制——此类方剂的炮制与用量需专业处理。</p>
            <button class="btn btn-sm" data-act="reveal">仍要查看原文制法</button>
          </div>
          <div data-method hidden>${esc(r.method)}</div>`
        : esc(r.method)
    )}
    ${blk("用法", esc(r.usage))}
    ${blk("功效", esc(r.effect))}
    ${
      r.caution
        ? blk("宜忌", esc(r.caution))
        : `<section class="blk blk-mute"><h3>宜忌</h3><div class="blk-b">原文未载禁忌。含中药材者，请由中医师看过再用。</div></section>`
    }
    ${
      cls.length
        ? blk(
            "偏性",
            `<div class="tags">${cls.map((x) => `<span>${esc(x.label)}</span>`).join("")}</div>
             <ul class="contra">
               ${cls.map((x) => `<li><em>${esc(x.label)}</em>${esc(x.text)}</li>`).join("")}
               ${(c.notes || []).map((n) => `<li><em>${esc(n.herb)}</em>${esc(n.note)}</li>`).join("")}
             </ul>
             ${auds.length ? `<p class="aud">需留意：${auds.map((a) => esc(a.label)).join("；")}。</p>` : ""}
             <p class="src">本栏按原料成分查表推出，非原书文字，也不能替代医师对该个体的判断。</p>`
          )
        : `<section class="blk blk-mute"><h3>偏性</h3><div class="blk-b">原料中未识别出需要提示偏性的药材。</div></section>`
    }
  </div>

  <div class="notice">
    <strong>${RISK[level] ? RISK[level].mark + " · " + RISK[level].label : ""}。</strong>${RISK[level]?.hint || ""}
  </div>

  <div class="act act-wide">
    <button class="btn" data-act="back2">${backLabel}</button>
    <a class="btn btn-text" href="#/quiz">用自测找方</a>
  </div>`;

  root.querySelector("[data-act='reveal']")?.addEventListener("click", (e) => {
    root.querySelector("[data-method]").hidden = false;
    e.currentTarget.closest(".veil").remove();
  });
  root.querySelector("[data-back]").addEventListener("click", (e) => {
    if (!onBack) return;
    e.preventDefault();
    onBack();
  });
  root.querySelector('[data-act="back2"]').addEventListener("click", () => onBack?.());
}

/* ── 凡例 ─────────────────────────────────────────────── */

export function about(root, data) {
  const total = data.recipes.length;
  const noPattern = data.recipes.filter((r) => !r.patterns?.length).length;
  const inferred = data.recipes.filter((r) => r.pattern_source === "inferred").length;
  const noCaution = data.recipes.filter((r) => !r.caution).length;
  const hasContra = data.recipes.filter((r) => r.contra?.classes?.length).length;

  root.innerHTML = `
  <header class="phead">
    <p class="kick">凡例</p>
    <h1 class="h1">这份数据是怎么来的</h1>
  </header>

  <div class="panel prose">
    <p>底本是一册民间食疗汤方，共 ${data.chapters.length} 类 ${total} 方，每方原本只有「原料 / 制作 / 用法 / 功效 / 宜忌」五栏。
    检索所需的症状、证型、偏性都是后加的。</p>

    <h3>整理过程</h3>
    <p>原书扫描件的文本层里，数字与标点被替换成了替身字形，机器抽取会得到 <code>#对$</code> 这类乱码。因汉字正确、数字不可恢复，
    改为<strong>按页面图像逐页重录</strong>，再用文本层的汉字序列做交叉校验（平均相似度 99.7%）。</p>

    <h3>派生字段与其可靠度</h3>
    <table class="kv">
      <tr><th>字段</th><th>做法</th><th>可靠度</th></tr>
      <tr><td>症状</td><td>从「适用于……」句式按关键词抽取</td><td>较高</td></tr>
      <tr><td>证型</td><td>从功效中的「肾阳虚 / 阴虚 / 湿热」等词判定，缺则按治法推断</td><td>原文 ${total - noPattern - inferred}、推断 ${inferred}、仍缺 ${noPattern}</td></tr>
      <tr><td>风险分层</td><td>按药材目录判定甲乙丙</td><td>规则判定，非临床评估</td></tr>
      <tr><td>原文宜忌</td><td>照抄原书</td><td>仅 ${total - noCaution} 条有</td></tr>
      <tr><td>偏性</td><td>按原料成分查表推出</td><td>覆盖 ${hasContra} 条，规则性提示</td></tr>
    </table>

    <h3>为什么不是「一个症状一个方」</h3>
    <p>原书从不说明同一症状下几十个方该怎么挑。实测功效覆盖两个以上症状的方占六成；阳痿一章仅 41 方，却有一百多个方的功效里提到阳痿。
    所以「症状 → 唯一答案」在数据上立不住。这里做的是<strong>收窄范围并给出依据</strong>，选不选、用不用，仍要由人或医师判断。</p>

    <details>
      <summary>明确做不到的</summary>
      <ul>
        <li>没有舌象、脉象、问诊细节，证型只到「倾向」。</li>
        <li>偏性由规则推出，认不出炮制差异、个体过敏与合并用药。</li>
        <li>不判断药物相互作用，不判断与西药同服的禁忌。</li>
        <li>不提供剂量换算、采购与炮制指引。</li>
      </ul>
    </details>

    <h3>免责</h3>
    <p><strong>本站为中医药膳知识的整理与学习项目，不构成医疗建议，不能替代面诊。</strong>
    页面中所有「倾向」「候选」均为检索排序结果，不是诊断结论，也不是用药推荐。</p>
  </div>`;
}


/* ── 历次记录 ─────────────────────────────────────────── */

export function history(root, data, list, { onClear } = {}) {
  const item = (r) => {
    const main = r.top?.name || "证型线索不足";
    const primary = r.answers?.q1 && r.answers.q1 !== "unsure" ? symptomName(data, r.answers.q1) : "";
    const extra = Array.isArray(r.answers?.q2) ? r.answers.q2.length : 0;
    const bits = [primary, extra ? `另选 ${extra} 项伴随` : "", timeFull(r.at)].filter(Boolean);
    return `<a class="hrow" href="#/result?h=${encodeURIComponent(r.id)}">
      <div class="hrow-b">
        <p class="hrow-t">${esc(main)}<span>${r.count ? `${r.count} 条候选` : ""}</span></p>
        <p class="hrow-s">${esc(bits.join(" · "))}</p>
      </div>
      <span class="chev" aria-hidden="true"></span>
    </a>`;
  };

  root.innerHTML = `
  <header class="phead">
    <p class="kick">历次自测</p>
    <h1 class="h1">${list.length ? `${list.length} 次记录` : "还没有记录"}</h1>
    <p class="sub">只存在这台设备的浏览器里，最多保留 8 次，90 天后自动清除。</p>
  </header>

  ${
    list.length
      ? `<div class="cands">${list.map(item).join("")}</div>
         <div class="act">
           <a class="btn" href="#/quiz?new=1">重新自测</a>
           <button class="btn btn-text" data-act="clear">清空记录</button>
         </div>`
      : `<div class="panel"><p class="hint" style="margin-top:0">做过一次自测，结果就会留在这里，方便回头再看。</p>
         <div class="act"><a class="btn btn-primary btn-block" href="#/quiz">开始自测</a></div></div>`
  }`;

  root.querySelector("[data-act='clear']")?.addEventListener("click", () => {
    if (window.confirm("清空全部自测记录？此操作不可撤销。")) onClear?.();
  });
}
