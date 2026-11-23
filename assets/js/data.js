// 数据加载与索引
const DATA_URL = "data/recipes.normalized.json";

let cache = null;

export async function loadData() {
  if (cache) return cache;
  const res = await fetch(DATA_URL, { cache: "force-cache" });
  if (!res.ok) throw new Error("数据加载失败：" + res.status);
  const raw = await res.json();

  const symptoms = new Map(raw.symptoms.map((s) => [s.id, s]));
  const patterns = new Map(raw.patterns.map((p) => [p.id, p]));
  const audiences = new Map((raw.audiences || []).map((a) => [a.id, a]));
  const byId = new Map();
  const byChapter = new Map();

  for (const r of raw.recipes) {
    byId.set(r.id, r);
    if (!byChapter.has(r.chapter_name)) byChapter.set(r.chapter_name, []);
    byChapter.get(r.chapter_name).push(r);
    // 预先建检索串，避免每次搜索重复拼接
    r._hay = [
      r.name,
      r.chapter_name,
      r.ingredients,
      r.effect,
      ...(r.therapies || []),
      ...(r.symptoms || []).map((id) => symptoms.get(id)?.name || ""),
      ...(r.contra?.classes || []).map((k) => raw.contra_classes?.[k]?.label || ""),
    ].join(" ").toLowerCase();
  }

  cache = {
    meta: raw.meta,
    symptoms: raw.symptoms,
    patterns: raw.patterns,
    symptomMap: symptoms,
    patternMap: patterns,
    audiences: raw.audiences || [],
    audienceMap: audiences,
    contraClasses: raw.contra_classes || {},
    recipes: raw.recipes,
    byId,
    chapters: [...byChapter.keys()],
  };
  return cache;
}

export function symptomName(data, id) {
  return data.symptomMap.get(id)?.name || id;
}

export function patternName(data, id) {
  return data.patternMap.get(id)?.name || id;
}

export function searchRecipes(data, keyword) {
  const q = keyword.trim().toLowerCase();
  if (!q) return data.recipes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return data.recipes.filter((r) => tokens.every((t) => r._hay.includes(t)));
}

export function filterRecipes(data, { chapter, pattern, risk, keyword } = {}) {
  let list = searchRecipes(data, keyword || "");
  if (chapter) list = list.filter((r) => r.chapter_name === chapter);
  if (pattern) list = list.filter((r) => (r.patterns || []).includes(pattern));
  if (risk) list = list.filter((r) => r.risk?.level === risk);
  return list;
}
