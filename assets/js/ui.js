// 视图渲染
import { symptomName, patternName, filterRecipes } from "./data.js";
import { buildQuestions, recommend, PATTERN_INFO, encodeAnswers } from "./quiz.js";
import { timeAgo, timeFull } from "./store.js";

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const RISK = {
  A: { mark: "甲", label: "药食同源", hint: "以食材为主，当成一道汤就行。" },
  B: { mark: "乙", label: "含中药材", hint: "含中药材，有偏性；寒热搞反了只会更难受。" },
  C: { mark: "丙", label: "仅知识条目", hint: "含毒性药、动物药或药酒，只供围观，别动手。" },
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
    <p class="hero-kick">网传偏方 · 仅供学习娱乐</p>
    <h1 class="h1 hero-t">食养方剂</h1>
    <p class="hero-p">${data.recipes.length} 条汤方，先圈症状，再按寒热虚实收窄，最后挑几条给你看理由。</p>
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

  <p class="fine fine-c">这册子怎么来的、哪儿不准，见 <a href="#/about">凡例</a>。</p>`;
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
            (o) => `<label class="opt${pickedArr.includes(o.id) ? " is-on" : ""}${o.wide ? " is-wide" : ""}">
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
      ${q.optional ? `<p class="fine fine-c">这一问可以跳过，不影响使用。</p>` : ""}
      ${state.step === 0 ? `<p class="fine fine-c">娱乐向的检索测验。结果不算诊断，别照着抓药。</p>` : ""}
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
    <p class="kick">自测结果 · 仅供学习娱乐</p>
    <h1 class="h1">${first ? esc(patternName(data, first.id)) : "证型线索不足"}</h1>
    <p class="sub">${savedAt ? timeAgo(savedAt) + " · " : ""}${data.recipes.length} 条里，${total} 条跟你的症状沾边，下面取前 ${list.length} 条</p>
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

  <div class="act act-pair">
    <a class="btn" href="#/quiz?new=1">重新自测</a>
    <button class="btn" data-act="share">复制链接</button>
  </div>
  <p class="fine fine-c">
    <button class="linkbtn" data-act="c">${includeC ? "收起丙层条目（含毒性药、动物药）" : "显示丙层条目（含毒性药、动物药）"}</button>
  </p>

  <div class="notice">
    <p>这几条只是<strong>字面沾边</strong>，谈不上对症。真不舒服，看医生比看这页靠谱。</p>
    <p>血精、睾丸有肿块、正发热，或备孕一年没动静——这几样别翻方子，直接挂泌尿外科或男科。</p>
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
    setTimeout(() => (btn.textContent = "复制链接"), 1800);
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
    const filtered = !!(state.ch || state.pat || state.risk || state.q);
    countEl.textContent = filtered ? `命中 ${all.length} 条` : "";
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
    <p class="sub">${esc(r.chapter_name)} · 原文 p.${r.page} · ${riskMark(level)} · ${
      r.patterns?.length ? esc(r.patterns.map((p) => patternName(data, p)).join("、")) : "原文未标证型"
    }</p>
  </header>

  <div class="panel panel-doc">
    ${blk("原料", esc(r.ingredients))}
    ${blk(
      "制作",
      hideMethod
        ? `<div class="veil">
            <p><strong>丙层条目。</strong>含毒性药、动物药或药酒，原文做法先遮住。</p>
            <button class="btn btn-sm" data-act="reveal">还是想看</button>
          </div>
          <div data-method hidden>${esc(r.method)}</div>`
        : esc(r.method)
    )}
    ${blk("用法", esc(r.usage))}
    ${blk("功效", esc(r.effect))}
    ${
      r.caution
        ? blk("宜忌", esc(r.caution))
        : `<section class="blk blk-mute"><h3>宜忌</h3><div class="blk-b">原文没写禁忌。</div></section>`
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
             <p class="src">按原料查表推的，不是原文，也代替不了医师的判断。</p>`
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
    <p class="kick">凡例 · 仅供学习娱乐</p>
    <h1 class="h1">这册子怎么来的</h1>
  </header>

  <div class="panel prose">
    <p>底本是一册网上流传的《释永信房中补肾秘方》，共 ${data.chapters.length} 类 ${total} 方，每方原本只有「原料 / 制作 / 用法 / 功效 / 宜忌」五栏。
    症状、证型、偏性都是后加的——加得不一定对。</p>

    <h3>整理过程</h3>
    <p>扫描件的文本层里，数字和标点被换成了替身字形，机器抽出来是 <code>#对$</code> 这种乱码。汉字是对的，数字救不回来，于是
    <strong>照着页面逐页重录</strong>，再用文本层的汉字序列比对（平均 99.7%）。</p>

    <h3>后加的字段，靠不靠得住</h3>
    <div class="kv">
      <div class="kv-r"><span class="kv-k">症状</span><span class="kv-v">较高</span><div class="kv-d">从「适用于……」句式按关键词抽</div></div>
      <div class="kv-r"><span class="kv-k">证型</span><span class="kv-v">原文 ${total - noPattern - inferred} · 推断 ${inferred} · 缺 ${noPattern}</span><div class="kv-d">从功效里的「肾阳虚 / 阴虚 / 湿热」等词判定，缺则按治法推</div></div>
      <div class="kv-r"><span class="kv-k">风险分层</span><span class="kv-v">规则判定</span><div class="kv-d">按药材目录判甲、乙、丙三层</div></div>
      <div class="kv-r"><span class="kv-k">原文宜忌</span><span class="kv-v">${total - noCaution} / ${total} 条</span><div class="kv-d">照抄，不补写</div></div>
      <div class="kv-r"><span class="kv-k">偏性</span><span class="kv-v">${hasContra} 条</span><div class="kv-d">按原料查表推的，不是原文</div></div>
    </div>

    <h3>为什么不是一个症状一个方</h3>
    <p>原文从没说过同一症状下几十个方该怎么挑。六成方子的功效覆盖两个以上症状；阳痿一章只有 41 方，功效里提到阳痿的却有一百多个。
    所以「症状 → 唯一答案」在数据上立不住，这里只做<strong>收窄并给理由</strong>。</p>

    <details>
      <summary>做不到的</summary>
      <ul>
        <li>没有舌象、脉象，证型只到「倾向」。</li>
        <li>认不出炮制差异、个体过敏与合并用药。</li>
        <li>不判断药物相互作用，也不管你还在吃别的药。</li>
        <li>不提供剂量换算、采购与炮制指引。</li>
      </ul>
    </details>

    <p class="prose-note">说到底，这是个整理偏方的检索玩具，<strong>仅供学习娱乐</strong>。不是医书，不能替代面诊，身体不舒服请去医院。</p>
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
