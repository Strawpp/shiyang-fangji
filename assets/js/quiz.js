// 自测问卷：题目、计分、编码
// 说明：问卷只用于把症状群收窄到「证型倾向」与候选方，不做诊断。

export const PATTERN_INFO = {
  shen_yang: {
    desc: "多见畏寒肢冷、腰膝冷痛、夜尿清长，方多温补。",
    caveat: "温燥药偏多；阴虚火旺、高血压、甲亢、失眠者不宜。",
  },
  shen_yin: {
    desc: "多见潮热盗汗、手足心热、口干、精液量少。",
    caveat: "滋腻碍胃，脾虚便溏者慎；单用滋阴对阳痿无效。",
  },
  jing_kui: {
    desc: "多见精少、不育、早衰、须发早白、发育不足。",
    caveat: "药性平和，但「生精」需较长周期，短期难验证。",
  },
  shen_qi: {
    desc: "多见乏力、腰膝酸软、小便频数而清。",
    caveat: "多与阳虚、精亏并见，需结合寒热判断。",
  },
  fei_shen_yin: {
    desc: "多见干咳少痰、咽干、盗汗，兼腰膝酸软。",
    caveat: "滋阴为主，注意脾胃运化。",
  },
  pi_shen_yang: {
    desc: "多见畏寒、食少、大便溏薄、腹部冷痛。",
    caveat: "温补脾肾，湿重者需先化湿。",
  },
  shi_re: {
    desc: "多见口苦、尿黄、局部潮湿坠胀。",
    caveat: "与温补方向相反，误用温燥会加重。",
  },
  qi_xue_yu: {
    desc: "多见胀痛、刺痛、情志不畅后加重。",
    caveat: "以行气活血为主，不宜一味温补。",
  },
  qi_xue_liang: {
    desc: "多见面色淡、心悸、乏力、易倦。",
    caveat: "气血双补，需兼顾脾胃吸收。",
  },
};

// 证型题的选项权重
const W = {
  cold: { shen_yang: 3, pi_shen_yang: 2 },
  hot: { shen_yin: 3, fei_shen_yin: 2 },
  dry_cold: { shen_yin: 2 },
  dry_warm: { shen_yang: 1, pi_shen_yang: 1 },
  loose: { pi_shen_yang: 2, qi_xue_liang: 1 },
  hard: { shen_yin: 2 },
  urine_clear: { shen_yang: 3, shen_qi: 2 },
  urine_yellow: { shi_re: 3 },
  insomnia: { shen_yin: 1, qi_xue_liang: 2 },
  sleepy: { pi_shen_yang: 2, shen_yang: 1 },
  tongue_pale: { shen_yang: 2, pi_shen_yang: 2 },
  tongue_red: { shen_yin: 3 },
  tongue_greasy: { shi_re: 3 },
  strain: { shen_yin: 1, qi_xue_liang: 1 },
  chronic: { qi_xue_liang: 2, shen_qi: 2 },
  emotion: { qi_xue_yu: 2 },
  excess: { jing_kui: 2, shen_yin: 1 },
};

export function buildQuestions(data) {
  const primary = data.symptoms.filter((s) => s.level === "primary");
  const secondary = data.symptoms.filter((s) => s.level === "secondary");

  return [
    {
      id: "q1", part: 1, type: "single",
      title: "眼下最困扰的是哪一项？",
      hint: "选一项即可。这一项决定候选方的范围。",
      options: [
        ...primary.map((s) => ({ id: s.id, label: s.name })),
        { id: "unsure", label: "说不清，只是觉得状态不如从前", wide: true },
      ],
    },
    {
      id: "q2", part: 1, type: "multi",
      title: "平时还伴随下面哪些情况？",
      hint: "可多选；没有就跳过。伴随症状会提高匹配度。",
      options: secondary.map((s) => ({ id: s.id, label: s.name })),
      optional: true,
    },
    {
      id: "q3", part: 1, type: "single",
      title: "这种情况持续多久了？",
      hint: "仅用于提示，不参与排序。",
      options: [
        { id: "lt1m", label: "不到 1 个月" },
        { id: "1to6m", label: "1～6 个月" },
        { id: "gt6m", label: "半年以上" },
      ],
    },
    {
      id: "q4", part: 1, type: "single",
      title: "与下面哪种情况有关？",
      hint: "选最接近的一项。",
      options: [
        { id: "strain", label: "长期熬夜、劳累", w: W.strain },
        { id: "chronic", label: "久病之后，身体一直没恢复", w: W.chronic },
        { id: "emotion", label: "压力大、郁怒、情绪不畅", w: W.emotion },
        { id: "excess", label: "房事不节、纵欲过度", w: W.excess },
        { id: "unknown", label: "说不清", w: {} },
      ],
    },
    {
      id: "q5", part: 2, type: "single",
      title: "平时更怕冷，还是更怕热？",
      hint: "寒热是辨证的第一分水岭。",
      options: [
        { id: "cold", label: "明显怕冷，手脚发凉", w: W.cold },
        { id: "hot", label: "怕热，手足心发热", w: W.hot },
        { id: "neither", label: "都不明显", w: {} },
      ],
    },
    {
      id: "q6", part: 2, type: "single",
      title: "会不会口干？想喝凉的还是热的？",
      hint: "口苦喜冷多偏热，口干喜温多偏虚寒。",
      options: [
        { id: "dry_cold", label: "口干，想喝凉水", w: W.dry_cold },
        { id: "dry_warm", label: "口干，但更想喝热水", w: W.dry_warm },
        { id: "no", label: "不太口干", w: {} },
      ],
    },
    {
      id: "q7", part: 2, type: "single",
      title: "大便的情况更接近哪一种？",
      options: [
        { id: "loose", label: "偏溏、不成形，或食后即泻", w: W.loose },
        { id: "normal", label: "基本正常", w: {} },
        { id: "hard", label: "偏干、排便费力", w: W.hard },
      ],
    },
    {
      id: "q8", part: 2, type: "single",
      title: "小便的情况更接近哪一种？",
      options: [
        { id: "urine_clear", label: "量多色清，夜里起夜多", w: W.urine_clear },
        { id: "urine_yellow", label: "色黄、量少，或有灼热感", w: W.urine_yellow },
        { id: "normal", label: "基本正常", w: {} },
      ],
    },
    {
      id: "q9", part: 2, type: "single",
      title: "睡眠如何？",
      options: [
        { id: "insomnia", label: "入睡难、多梦、易醒", w: W.insomnia },
        { id: "sleepy", label: "总觉得困、睡不够", w: W.sleepy },
        { id: "ok", label: "尚可", w: {} },
      ],
    },
    {
      id: "q10", part: 2, type: "single",
      title: "对着镜子看舌头，最接近哪一种？",
      hint: "看不清、拿不准就选最后一项，不影响使用。",
      options: [
        { id: "tongue_pale", label: "舌体偏胖、色淡，边缘有齿痕", w: W.tongue_pale },
        { id: "tongue_red", label: "舌体偏瘦、色红，苔少或无苔", w: W.tongue_red },
        { id: "tongue_greasy", label: "舌苔黄厚而腻", w: W.tongue_greasy },
        { id: "unknown", label: "不清楚", w: {} },
      ],
    },
  ];
}

// —— 计分 ——————————————————————————————————————————————

function weightsOf(answers, questions) {
  const pattern = {};
  for (const q of questions) {
    const a = answers[q.id];
    if (!a) continue;
    const picked = Array.isArray(a) ? a : [a];
    for (const oid of picked) {
      const opt = q.options.find((o) => o.id === oid);
      if (!opt?.w) continue;
      for (const [k, v] of Object.entries(opt.w)) pattern[k] = (pattern[k] || 0) + v;
    }
  }
  return pattern;
}

export function patternScores(answers, questions) {
  const raw = weightsOf(answers, questions);
  const max = Math.max(1, ...Object.values(raw));
  return Object.entries(raw)
    .map(([id, v]) => ({ id, score: v / max }))
    .sort((a, b) => b.score - a.score);
}

function symptomWeights(answers) {
  const w = {};
  if (answers.q1 && answers.q1 !== "unsure") w[answers.q1] = 1;
  const extra = Array.isArray(answers.q2) ? answers.q2 : [];
  for (const id of extra) if (!w[id]) w[id] = 0.55;
  return w;
}

export function recommend(data, answers, { limit = 5, includeC = false } = {}) {
  const questions = buildQuestions(data);
  const pw = patternScores(answers, questions);
  const pMap = new Map(pw.map((p) => [p.id, p.score]));
  const sw = symptomWeights(answers);
  const totalSymptom = Object.values(sw).reduce((a, b) => a + b, 0) || 1;
  const mySigns = userAudiences(answers, data.audiences);

  const scored = [];
  for (const r of data.recipes) {
    const level = r.risk?.level || "B";
    if (level === "C" && !includeC) continue;

    let matched = 0;
    const hitSymptoms = [];
    for (const s of r.symptoms || []) {
      if (sw[s]) {
        matched += sw[s];
        hitSymptoms.push(s);
      }
    }
    if (matched === 0) continue;
    const symScore = Math.min(1, matched / (totalSymptom * 1.25));

    const pats = r.patterns || [];
    let patScore = 0.45; // 无证型标注时中性
    let hitPatterns = [];
    if (pats.length) {
      hitPatterns = pats.filter((p) => pMap.has(p));
      const vals = pats.map((p) => pMap.get(p) || 0);
      patScore = Math.max(...vals) * 0.7 + (vals.reduce((a, b) => a + b, 0) / pats.length) * 0.3;
      // 证型是据治法推断的，往中性收一些，避免与原文明确的条目同权
      if (r.pattern_source === "inferred") patScore = patScore * 0.65 + 0.45 * 0.35;
    }

    // 与本人寒热虚实相冲的偏性：扣分并显式提示，不静默过滤
    const conflicts = (r.contra?.audiences || []).filter((a) => mySigns.has(a));
    const penalty = Math.max(0.55, 1 - 0.18 * conflicts.length);

    const score = (symScore * 0.6 + patScore * 0.4) * penalty;
    scored.push({ recipe: r, score, symScore, patScore, hitSymptoms, hitPatterns, conflicts });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.conflicts.length - b.conflicts.length ||
      riskRank(a.recipe) - riskRank(b.recipe)
  );
  return { list: scored.slice(0, limit), patterns: pw.slice(0, 3), total: scored.length };
}

/**
 * 把问卷答案翻译成「体质信号」，用于与方剂的偏性做冲突判定。
 * 只取 audiences 里声明了 from 的人群（阴虚、实热、脾虚、湿热、失眠、便秘等）。
 */
export function userAudiences(answers, audiences = []) {
  const picked = new Set();
  for (const v of Object.values(answers || {})) {
    if (Array.isArray(v)) v.forEach((x) => picked.add(x));
    else if (v) picked.add(v);
  }
  const out = new Set();
  for (const a of audiences) {
    if (!a.from?.length) continue;
    if (a.from.some((f) => picked.has(f))) out.add(a.id);
  }
  return out;
}

function riskRank(r) {
  return { A: 0, B: 1, C: 2 }[r.risk?.level || "B"];
}

// —— 答案编解码（可分享链接）—————————————————————————————

export function encodeAnswers(answers) {
  const json = JSON.stringify(answers);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeAnswers(str) {
  try {
    let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return null;
  }
}
