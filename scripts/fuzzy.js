/* ===================================================================
   FUZZY NAME RESOLUTION
   ===================================================================
   - 파일명 / 시트명 / 컬럼명을 정확히 안 맞춰도 유사도로 찾도록 한다.
   - 기본 임계값 0.85, 모호하면(2위와 점수차 < 0.1) 사용자 확인.
   =================================================================== */

const FUZZY_THRESHOLD = 0.85;
const FUZZY_AMBIGUITY_GAP = 0.1;

function _normalize(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeText(value) {
  return _normalize(value);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prev = new Array(bl + 1);
  let cur  = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[bl];
}

function similarity(a, b) {
  const na = _normalize(a), nb = _normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // substring bonus — 흔히 쓰는 별칭/약어 케이스
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.7 + 0.3 * ratio;
  }
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

// 후보 중 가장 유사한 항목과 차순위, 모호 여부를 반환
function fuzzyMatch(needle, candidates, threshold) {
  threshold = (typeof threshold === "number") ? threshold : FUZZY_THRESHOLD;
  if (!needle || !candidates || candidates.length === 0) return null;
  const scored = candidates.map(c => ({ name: c, score: similarity(needle, c) }));
  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score === 1) return { match: scored[0].name, score: 1, ambiguous: false, alts: [] };
  if (scored[0].score < threshold) return null;
  const top = scored[0];
  const second = scored[1];
  const ambiguous = !!(second && second.score >= threshold && (top.score - second.score) < FUZZY_AMBIGUITY_GAP);
  const alts = scored.filter(s => s.score >= threshold).slice(0, 5).map(s => s.name);
  return { match: top.name, score: top.score, ambiguous, alts };
}

// inputs / sheets / 컬럼맵 등을 fuzzy lookup이 가능한 Proxy로 감싼다.
// 모호한 경우 onAmbiguous(prop, alts) 가 호출된다(처음 한 번만).
// 매칭이 일어나면 onResolve(prop, match, score) 호출.
function fuzzyProxy(target, options) {
  options = options || {};
  const cache = options.cache || {};
  const handler = {
    get(t, prop) {
      if (typeof prop === "symbol") return t[prop];
      if (prop === "__isFuzzy") return true;
      if (Object.prototype.hasOwnProperty.call(t, prop)) return t[prop];
      const cacheKey = String(prop);
      if (cache[cacheKey] !== undefined) {
        return t[cache[cacheKey]];
      }
      const keys = Object.keys(t);
      const result = fuzzyMatch(cacheKey, keys);
      if (!result) return undefined;
      if (result.ambiguous && options.onAmbiguous) {
        options.onAmbiguous(cacheKey, result.alts);
      }
      cache[cacheKey] = result.match;
      if (options.onResolve) options.onResolve(cacheKey, result.match, result.score);
      return t[result.match];
    },
    set(t, prop, value) {
      if (typeof prop === "symbol" || Object.prototype.hasOwnProperty.call(t, prop)) {
        t[prop] = value;
        return true;
      }
      // 새 key는 그대로 추가 (수식 키 추가 케이스). 단, 이미 캐싱된 매칭이 있으면 그쪽에 쓴다.
      const cacheKey = String(prop);
      if (cache[cacheKey]) {
        t[cache[cacheKey]] = value;
        return true;
      }
      const keys = Object.keys(t);
      const result = fuzzyMatch(cacheKey, keys);
      if (result && !result.ambiguous) {
        t[result.match] = value;
        cache[cacheKey] = result.match;
      } else {
        t[prop] = value;
      }
      return true;
    },
    has(t, prop) {
      if (typeof prop === "symbol" || Object.prototype.hasOwnProperty.call(t, prop)) return true;
      const result = fuzzyMatch(String(prop), Object.keys(t));
      return !!result;
    },
    ownKeys(t) { return Reflect.ownKeys(t); },
    getOwnPropertyDescriptor(t, prop) {
      return Object.getOwnPropertyDescriptor(t, prop);
    },
  };
  return new Proxy(target, handler);
}

// AoA의 헤더 행에서 컬럼명 → 인덱스 매핑을 찾는다.
// 헤더가 첫 행이 아닌 경우(예: 표 위 제목)를 위해 첫 비어있지 않은 행을 헤더로 추정한다.
function detectHeaderRow(aoa) {
  if (!aoa || aoa.length === 0) return -1;
  for (let r = 0; r < Math.min(5, aoa.length); r++) {
    const row = aoa[r] || [];
    const nonEmpty = row.filter(v => v !== "" && v !== null && v !== undefined).length;
    if (nonEmpty >= 2) return r;
  }
  return 0;
}

// step 코드에서 호출 가능한 헬퍼: col(sheetAoA, "회사명") → 컬럼 인덱스
function col(sheetAoA, name, options) {
  if (!sheetAoA || !Array.isArray(sheetAoA)) return -1;
  options = options || {};
  const headerRow = (typeof options.headerRow === "number") ? options.headerRow : detectHeaderRow(sheetAoA);
  if (headerRow < 0) return -1;
  const header = sheetAoA[headerRow] || [];
  const names = header.map(v => String(v || ""));
  // exact first
  const exact = names.findIndex(n => n === String(name));
  if (exact >= 0) return exact;
  const result = fuzzyMatch(String(name), names.filter(n => n !== ""));
  if (!result) return -1;
  return names.indexOf(result.match);
}

// 전체 inputs 안에서 같은 컬럼명을 가진 (file, sheet, colIdx) 튜플 찾기
function findColumnGlobal(inputsMap, name) {
  const hits = [];
  Object.keys(inputsMap || {}).forEach(fileName => {
    const sheets = inputsMap[fileName] || {};
    Object.keys(sheets).forEach(sheetName => {
      const aoa = sheets[sheetName];
      const idx = col(aoa, name);
      if (idx >= 0) hits.push({ file: fileName, sheet: sheetName, colIdx: idx });
    });
  });
  return hits;
}
