const UNIT_HEADER_REGEX = /^UNIT\s*(\d+)\s*[-–—:：]?\s*(.*)$/i;
const GROUP_HEADER_REGEX = /^Group\s*(\d+)\s*[：:.\-–—]?\s*(.*)$/i;
const STAR_LINE_REGEX = /^⭐+\s*(.+)$/;
const PARENTHESIS_LINE_REGEX = /^[（(].+[)）]$/;
const PAGE_REGEX = /\s*[（(]\s*(?:P|p|Page)?\s*(\d+)\s*[)）]\s*$/;
const CHINESE_REGEX = /[\u4e00-\u9fff]/;
const LETTER_REGEX = /[a-z]/i;
const PIPE_DELIMITERS = ["|", "｜"];

export interface JsonSentencePayload {
  title?: string;
  en: string;
  cn?: string;
  summary?: string;
  difficulty?: number;
  pageNumber?: number;
  type?: string;
  payload?: Record<string, unknown>;
}

export interface JsonRoundPayload {
  title?: string;
  roundNumber?: number;
  sentences: JsonSentencePayload[];
}

export interface JsonUnitPayload {
  unitId?: string;
  sequence?: number;
  title: string;
  description?: string;
  rounds: JsonRoundPayload[];
}

export interface JsonCourseImportPayload {
  packageSummary?: string;
  rounds?: number;
  sentencesPerRound?: number;
  units: JsonUnitPayload[];
}

interface PendingSentence {
  en: string;
  pageNumber?: number;
}

interface UnitContext {
  unit: JsonUnitPayload;
  rounds: Map<string, JsonRoundPayload>;
}

export interface ManualParseResult {
  payload: JsonCourseImportPayload;
  warnings: string[];
}

const sanitizeSentenceText = (text: string): string =>
  text.replace(/\s+/g, " ").replace(/\s+([,.;?!])/g, "$1").trim();

const extractPageNumber = (line: string): { text: string; page?: number } => {
  const match = line.match(PAGE_REGEX);
  if (!match) {
    return { text: sanitizeSentenceText(line) };
  }
  const pageNumber = Number(match[1]);
  const textWithoutPage = sanitizeSentenceText(line.replace(PAGE_REGEX, ""));
  return { text: textWithoutPage, page: Number.isNaN(pageNumber) ? undefined : pageNumber };
};

const parsePageValue = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/\d+/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const isLikelyChinese = (line: string) => CHINESE_REGEX.test(line);
const isLikelyEnglish = (line: string) => LETTER_REGEX.test(line) || !isLikelyChinese(line);

const createUnitTitle = (sequence: number | undefined, suffix?: string) => {
  if (typeof sequence === "number" && suffix) {
    return `Unit ${sequence} ${suffix.startsWith("–") || suffix.startsWith("-") ? suffix : `– ${suffix}`}`.trim();
  }
  if (typeof sequence === "number") {
    return `Unit ${sequence}`;
  }
  return suffix && suffix.length ? suffix : "Unit";
};

const extractSequence = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/\d+/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const finalizePayload = (
  units: JsonUnitPayload[],
  warnings: string[],
  packageSummary?: string
): ManualParseResult => {
  const normalizedUnits = units
    .map(unit => ({
      ...unit,
      rounds: unit.rounds
        .map(round => ({
          ...round,
          sentences: round.sentences.filter(sentence => sentence.en.trim().length > 0)
        }))
        .filter(round => round.sentences.length > 0)
    }))
    .filter(unit => unit.rounds.length > 0);

  if (!normalizedUnits.length) {
    throw new Error("没有解析到任何有效的单元或句子，请检查文本格式。");
  }

  const maxRounds = normalizedUnits.reduce((max, unit) => Math.max(max, unit.rounds.length), 0);
  const maxSentences = normalizedUnits.reduce((max, unit) => {
    const unitMax = unit.rounds.reduce((roundMax, round) => Math.max(roundMax, round.sentences.length), 0);
    return Math.max(max, unitMax);
  }, 0);

  return {
    payload: {
      packageSummary,
      rounds: maxRounds || undefined,
      sentencesPerRound: maxSentences || undefined,
      units: normalizedUnits
    },
    warnings
  };
};

const tryParseTableFormat = (lines: string[]): ManualParseResult | null => {
  const trimmedLines = lines.map(line => line.trim()).filter(Boolean);
  const tableRows = trimmedLines
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => PIPE_DELIMITERS.some(delimiter => line.includes(delimiter)));

  if (!tableRows.length) {
    return null;
  }

  const unitsMap = new Map<string, UnitContext>();
  const warnings: string[] = [];
  let validRowCount = 0;

  for (const row of tableRows) {
    const delimiter = PIPE_DELIMITERS.find(symbol => row.line.includes(symbol)) ?? "|";
    const parts = row.line.split(delimiter).map(value => value.trim());
    if (parts.length < 4) {
      warnings.push(`第 ${row.lineNumber} 行未达到 “单元 | 分组 | 英文 | 中文” 四列格式，已跳过。`);
      continue;
    }
    const [unitRaw, groupRaw, englishRaw, chineseRaw, pageRaw] = parts;
    const english = englishRaw?.trim();
    if (!english) {
      warnings.push(`第 ${row.lineNumber} 行缺少英文句子，已跳过。`);
      continue;
    }
    validRowCount += 1;
    const chinese = chineseRaw?.trim() ?? "";
    const { text: enText, page: pageFromEnglish } = extractPageNumber(english);
    const explicitPage = parsePageValue(pageRaw);
    const pageNumber = explicitPage ?? pageFromEnglish;
    const unitTitle = unitRaw || "Unit";
    const unitSequence = extractSequence(unitRaw);
    const unitKey = unitTitle.toLowerCase();
    let context = unitsMap.get(unitKey);
    if (!context) {
      context = {
        unit: {
          title: unitTitle,
          sequence: unitSequence,
          rounds: []
        },
        rounds: new Map()
      };
      unitsMap.set(unitKey, context);
    } else if (!context.unit.sequence && unitSequence) {
      context.unit.sequence = unitSequence;
    }

    const groupTitle = groupRaw || "Group 1";
    const groupKey = groupTitle.toLowerCase();
    let round = context.rounds.get(groupKey);
    if (!round) {
      round = {
        title: groupTitle,
        roundNumber: extractSequence(groupTitle),
        sentences: []
      };
      context.rounds.set(groupKey, round);
      context.unit.rounds.push(round);
    } else if (!round.roundNumber) {
      round.roundNumber = extractSequence(groupTitle);
    }

    round.sentences.push({
      en: enText,
      cn: chinese,
      summary: enText,
      pageNumber,
      title: undefined
    });
  }

  if (!validRowCount) {
    return null;
  }

  return finalizePayload(
    Array.from(unitsMap.values()).map(entry => entry.unit),
    warnings
  );
};

export const parseManualSentenceText = (text: string): ManualParseResult => {
  const lines = text.split(/\r?\n/);
  const tableResult = tryParseTableFormat(lines);
  if (tableResult) {
    return tableResult;
  }

  const warnings: string[] = [];
  const units: JsonUnitPayload[] = [];

  let packageSummary: string | undefined;
  let currentUnit: JsonUnitPayload | null = null;
  let currentGroup: JsonRoundPayload | null = null;
  let expectingGroupSubtitle = false;
  let pendingSentence: PendingSentence | null = null;

  const pushPendingSentence = (reason?: string) => {
    if (!pendingSentence || !currentGroup) return;
    currentGroup.sentences.push({
      en: pendingSentence.en,
      summary: pendingSentence.en,
      pageNumber: pendingSentence.pageNumber,
      cn: ""
    });
    if (reason) {
      warnings.push(reason);
    }
    pendingSentence = null;
  };

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return;
    }

    const starMatch = trimmed.match(STAR_LINE_REGEX);
    if (starMatch) {
      const content = starMatch[1].trim();
      if (!packageSummary) {
        packageSummary = content;
      }
      if (currentUnit && !currentUnit.description) {
        currentUnit.description = content;
      }
      return;
    }

    const unitMatch = trimmed.match(UNIT_HEADER_REGEX);
    if (unitMatch) {
      if (pendingSentence) {
        warnings.push(`第 ${lineNumber} 行前的英语句子缺少译文，已自动补空。`);
        pushPendingSentence();
      }
      const sequence = Number(unitMatch[1]);
      const suffix = unitMatch[2]?.trim();
      const title = createUnitTitle(sequence, suffix);
      currentUnit = {
        sequence: Number.isFinite(sequence) ? sequence : undefined,
        title,
        rounds: []
      };
      units.push(currentUnit);
      currentGroup = null;
      expectingGroupSubtitle = false;
      return;
    }

    if (!currentUnit) {
      return;
    }

    const groupMatch = trimmed.match(GROUP_HEADER_REGEX);
    if (groupMatch) {
      if (pendingSentence) {
        warnings.push(`第 ${lineNumber} 行前的英语句子缺少译文，已自动补空。`);
        pushPendingSentence();
      }
      const roundNumber = Number(groupMatch[1]);
      const label = groupMatch[2]?.trim();
      const title = label ? `Group ${roundNumber}：${label}` : `Group ${roundNumber}`;
      currentGroup = {
        title,
        roundNumber: Number.isFinite(roundNumber) ? roundNumber : undefined,
        sentences: []
      };
      currentUnit.rounds.push(currentGroup);
      expectingGroupSubtitle = true;
      return;
    }

    if (!currentGroup) {
      return;
    }

    if (expectingGroupSubtitle && PARENTHESIS_LINE_REGEX.test(trimmed)) {
      currentGroup.title = `${currentGroup.title ?? ""} ${trimmed}`.trim();
      expectingGroupSubtitle = false;
      return;
    }
    expectingGroupSubtitle = false;

    const hasChinese = isLikelyChinese(trimmed);
    if (!pendingSentence) {
      if (hasChinese && !isLikelyEnglish(trimmed)) {
        warnings.push(`第 ${lineNumber} 行检测到中文句子，但缺少对应的英文，已忽略：${trimmed}`);
        return;
      }
      const { text: enText, page } = extractPageNumber(trimmed);
      if (!enText) {
        warnings.push(`第 ${lineNumber} 行的英文句子为空，已跳过。`);
        return;
      }
      pendingSentence = { en: enText, pageNumber: page };
      return;
    }

    if (!hasChinese && isLikelyEnglish(trimmed)) {
      pushPendingSentence(`第 ${lineNumber} 行前的英文句子没有检测到中文翻译，已留空。`);
      const { text: enText, page } = extractPageNumber(trimmed);
      pendingSentence = { en: enText, pageNumber: page };
      return;
    }

    currentGroup.sentences.push({
      en: pendingSentence.en,
      summary: pendingSentence.en,
      cn: trimmed,
      pageNumber: pendingSentence.pageNumber
    });
    pendingSentence = null;
  });

  if (pendingSentence) {
    pushPendingSentence("文本末尾的英文句子缺少译文，已自动补空。");
  }

  return finalizePayload(units, warnings, packageSummary);
};
