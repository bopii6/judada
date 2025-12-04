import pdf from "pdf-parse";

import { getEnv } from "../config/env";
import { callOpenAIWithRetry,getOpenAI } from "../lib/openai";

export interface TextbookUnitEntry {
  unitLabel: string;
  topic?: string;
  startPage: number;
  endPage: number;
  lessonPages: number[];
}

export interface TextbookTocResult {
  units: TextbookUnitEntry[];
  totalPages: number;
  pageOffset: number | null;
  printedPageNumbers: (number | null)[];
}

type PdfPageData = {
  pageNumber: number;
  getTextContent: () => Promise<{
    items: Array<{ str?: string; hasEOL?: boolean }>;
  }>;
};

const normalizeLine = (line: string) => line.replace(/\s+/g, " ").trim();

const cleanTopicText = (value: string | undefined | null) => {
  if (!value) return "";
  return value.replace(/\.{2,}\s*\d+\s*$/, "").trim();
};

const splitPageToLines = (page: string) =>
  page
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

const isLessonIntroPage = (lines: string[]) =>
  lines.some(line => /^UNIT\s+\d+\s*$/i.test(line)) && lines.some(line => /Lessons?/i.test(line));

const buildTocLines = (pages: string[]): string[] => {
  const contentsIndex = pages.findIndex(text => /contents/i.test(text));
  const start = contentsIndex === -1 ? 0 : contentsIndex;
  const collected: string[] = [];
  for (let i = start; i < pages.length && i < start + 6; i++) {
    const pageLines = splitPageToLines(pages[i]);
    if (i > start && isLessonIntroPage(pageLines)) {
      break;
    }
    collected.push(...pageLines);
    if (pageLines.some(line => /^reading for fun/i.test(line))) {
      break;
    }
  }
  return collected.filter(Boolean);
};

const expandTocLines = (lines: string[]): string[] => {
  const expanded: string[] = [];
  const keywordPattern = /(Words in Each Unit|Vocabulary|Reading for Fun)[^U]*?\d+/gi;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed
      .split(/(?=Unit\s+\d+)/i)
      .map(part => part.replace(/^CONTENTS\s*/i, "").trim())
      .filter(Boolean);
    if (parts.length > 1) {
      parts.forEach(part => {
        const pieces: string[] = [];
        let lastIndex = 0;
        for (const match of part.matchAll(keywordPattern)) {
          const index = match.index ?? 0;
          const before = part.slice(lastIndex, index).trim();
          if (before) {
            pieces.push(before);
          }
          pieces.push(match[0].trim());
          lastIndex = index + match[0].length;
        }
        const tail = part.slice(lastIndex).trim();
        if (tail) {
          pieces.push(tail);
        }
        expanded.push(...pieces.filter(Boolean));
      });
      continue;
    }
    expanded.push(trimmed);
  }
  return expanded;
};

const parseUnitsFromLines = (lines: string[], totalPages: number): TextbookUnitEntry[] => {
  const sections: Array<{ header: string; lines: string[] }> = [];
  let current: { header: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (/^UNIT\s+/i.test(line)) {
      if (current) {
        sections.push(current);
      }
      current = { header: line, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    sections.push(current);
  }

  const results: TextbookUnitEntry[] = [];

  for (const section of sections) {
    const rawHeader = section.header;
    const unitMatch = rawHeader.match(/(UNIT\s+[A-Z0-9]+(?:\s+\w+)?)/i);
    const unitLabel = unitMatch ? unitMatch[0].replace(/\s+/g, " ").trim() : rawHeader;
    let topic = cleanTopicText(rawHeader.replace(unitLabel, "").trim());
    const headerPageMatch = rawHeader.match(/(\d{1,3})\s*$/);
    const headerPage = headerPageMatch ? Number(headerPageMatch[1]) : undefined;

    const bodyLines = [...section.lines];
    if (!topic && bodyLines.length > 0) {
      topic = cleanTopicText(bodyLines.shift() ?? "");
    }
    const bodyText = bodyLines.join(" ");

    const lessonPages = Array.from(
      bodyText.matchAll(/Lesson\s*\d+(?:[A-Za-z]*)\s+(\d{1,3})/gi)
    ).map(match => Number(match[1]));

    if (lessonPages.length === 0) {
      const standaloneNumbers = bodyLines
        .map(line => line.trim())
        .filter(line => /^\d{1,3}$/.test(line))
        .map(line => Number(line));
      if (standaloneNumbers.length >= 2) {
        lessonPages.push(...standaloneNumbers);
      }
    }

    if (lessonPages.length === 0 && typeof headerPage === "number" && Number.isFinite(headerPage)) {
      lessonPages.push(headerPage);
    }

    if (lessonPages.length === 0) {
      continue;
    }

    const filteredPages = lessonPages
      .map(page => Math.round(page))
      .filter(page => Number.isFinite(page) && page >= 1 && page <= totalPages);

    if (filteredPages.length === 0) {
      continue;
    }

    const startPage = Math.min(...filteredPages);
    const endPage = Math.max(...filteredPages);

    if (startPage > endPage) {
      continue;
    }

    results.push({
      unitLabel,
      topic: topic || undefined,
      startPage,
      endPage,
      lessonPages: filteredPages.sort((a, b) => a - b)
    });
  }

  results.sort((a, b) => a.startPage - b.startPage);
  for (let i = 0; i < results.length; i++) {
    const entry = results[i];
    if (entry.lessonPages.length <= 1) {
      const next = results[i + 1];
      if (next && next.startPage > entry.startPage) {
        entry.endPage = Math.max(entry.startPage, next.startPage - 1);
      } else {
        entry.endPage = Math.max(entry.startPage, totalPages);
      }
    } else {
      entry.endPage = Math.max(entry.startPage, entry.endPage);
    }
  }

  return results;
};

type AiUnitItem = {
  unitLabel?: string;
  topic?: string;
  startPage?: number;
  endPage?: number;
};

const sanitizeAiUnits = (items: AiUnitItem[], totalPages: number): TextbookUnitEntry[] => {
  const normalized: TextbookUnitEntry[] = [];
  for (const item of items) {
    if (!item?.unitLabel || typeof item.startPage !== "number" || typeof item.endPage !== "number") {
      continue;
    }
    const start = Math.max(1, Math.min(totalPages, Math.round(item.startPage)));
    const end = Math.max(start, Math.min(totalPages, Math.round(item.endPage)));
    normalized.push({
      unitLabel: item.unitLabel.trim(),
      topic: item.topic?.trim() || undefined,
      startPage: start,
      endPage: end,
      lessonPages: [start]
    });
  }
  return normalized;
};

const dedupeUnits = (entries: TextbookUnitEntry[]): TextbookUnitEntry[] => {
  const seen = new Map<string, TextbookUnitEntry>();
  for (const entry of entries) {
    const key = `${entry.unitLabel.toLowerCase()}-${entry.startPage}`;
    if (!seen.has(key)) {
      seen.set(key, entry);
    }
  }
  return Array.from(seen.values());
};

const parseUnitsWithAi = async (tocText: string, totalPages: number): Promise<TextbookUnitEntry[]> => {
  try {
    const ai = getOpenAI();
    const { OPENAI_MODEL_NAME } = getEnv();
    if (!OPENAI_MODEL_NAME) {
      throw new Error("未配置 OPENAI_MODEL_NAME");
    }
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        units: {
          type: "array",
          items: {
            type: "object",
            required: ["unitLabel", "startPage", "endPage"],
            additionalProperties: false,
            properties: {
              unitLabel: { type: "string" },
              topic: { type: "string" },
              startPage: { type: "integer", minimum: 1 },
              endPage: { type: "integer", minimum: 1 }
            }
          }
        }
      },
      required: ["units"]
    };

    const instructions =
      "You are a textbook assistant. Read the provided table-of-contents text, extract each unit entry with its title, optional topic, and start/end page numbers. Only rely on TOC lines that include page numbers, ignore any subsequent lesson or body text, and return JSON only.";

    const input = `Total pages: ${totalPages}
TOC snippet (may be truncated):
${tocText}`;

    const response = await callOpenAIWithRetry(() =>
      ai.responses.parse({
        model: OPENAI_MODEL_NAME,
        instructions,
        input,
        text: {
          format: {
            type: "json_schema",
            name: "textbook_toc",
            schema,
            strict: false
          }
        },
        temperature: 0.2
      })
    );

    const parsed = (response.output_parsed as { units?: AiUnitItem[] } | null)?.units ?? [];
    return sanitizeAiUnits(parsed, totalPages);
  } catch (error) {
    console.error("[Textbook TOC] AI parsing failed:", (error as Error).message);
    return [];
  }
};

const detectPageOffset = (units: TextbookUnitEntry[], pages: string[]): number | null => {
  if (!units.length || !pages.length) {
    return null;
  }
  const normalizedPages = pages.map(text =>
    (text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
  const sortedUnits = [...units].sort((a, b) => a.startPage - b.startPage);
  for (const unit of sortedUnits) {
    const searchPhrases: string[] = [];
    if (unit.unitLabel) {
      searchPhrases.push(unit.unitLabel.toLowerCase());
      const unitOnly = unit.unitLabel.match(/unit\s+\d+/i);
      if (unitOnly?.[0]) {
        searchPhrases.push(unitOnly[0].toLowerCase());
      }
    }
    if (unit.topic) {
      searchPhrases.push(unit.topic.toLowerCase());
    }
    searchPhrases.push("lesson 1");
    for (let i = 0; i < normalizedPages.length; i += 1) {
      const pageText = normalizedPages[i];
      if (!pageText) continue;
      if (searchPhrases.some(phrase => phrase && pageText.includes(phrase))) {
        const offset = unit.startPage - (i + 1);
        console.info(`[Textbook TOC] detected page offset ${offset} using unit "${unit.unitLabel}" on pdf page ${i + 1}`);
        return offset;
      }
    }
  }
  return null;
};

interface DigitCandidate {
  value: string;
  x: number;
  y: number;
}

const buildPrintedPageNumbers = (pages: DigitCandidate[][]): (number | null)[] =>
  pages.map(digits => {
    if (!digits?.length) {
      return null;
    }
    const minY = Math.min(...digits.map(candidate => candidate.y ?? 0));
    const threshold = minY + 2;
    const bottomDigits = digits
      .filter(candidate => (candidate.y ?? 0) <= threshold)
      .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));

    if (!bottomDigits.length) {
      return null;
    }
    const text = bottomDigits.map(candidate => candidate.value).join("");
    if (!/^\d{1,4}$/.test(text)) {
      return null;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  });

const detectPageOffsetFromFooters = (numbers: (number | null)[]): number | null => {
  for (let index = 0; index < numbers.length; index += 1) {
    const printed = numbers[index];
    if (printed && Number.isFinite(printed)) {
      const offset = printed - (index + 1);
      console.info(`[Textbook TOC] detected footer page offset ${offset} on pdf page ${index + 1}`);
      return offset;
    }
  }
  return null;
};

export const extractTextbookToc = async (buffer: Buffer): Promise<TextbookTocResult> => {
  const pageTexts: string[] = [];
  const pageLines: string[][] = [];
  const pageDigits: DigitCandidate[][] = [];
  const data = await pdf(buffer, {
    pagerender: async (pageData: PdfPageData) => {
      const textContent = await pageData.getTextContent();
      const lines: string[] = [];
      const digitCandidates: DigitCandidate[] = [];
      let currentLine = "";
      for (const rawItem of textContent.items) {
        const item = rawItem as { str?: string; hasEOL?: boolean; transform?: number[] };
        const chunk = item.str ?? "";
        currentLine += chunk;
        if (chunk && /^\d+$/.test(chunk)) {
          const transform = item.transform ?? [];
          digitCandidates.push({
            value: chunk,
            x: typeof transform[4] === "number" ? transform[4] : 0,
            y: typeof transform[5] === "number" ? transform[5] : 0
          });
        }
        if (item.hasEOL) {
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
          currentLine = "";
        } else {
          currentLine += " ";
        }
      }
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      const text = lines.join("\n");
      pageTexts[pageData.pageNumber - 1] = text;
      pageLines[pageData.pageNumber - 1] = lines;
      pageDigits[pageData.pageNumber - 1] = digitCandidates;
      return `${text}\n`;
    }
  });

  const totalPages = data.numpages ?? pageTexts.length;
  const printedPageNumbers = buildPrintedPageNumbers(pageDigits);
  const tocLines = expandTocLines(buildTocLines(pageTexts));
  console.info("[Textbook TOC] collected lines:", tocLines.slice(0, 12));

  let units = parseUnitsFromLines(tocLines, totalPages);
  console.info("[Textbook TOC] rule units:", units.map(unit => `${unit.unitLabel}(${unit.startPage}-${unit.endPage})`));
  if (!units.length) {
    const tocSnippet = tocLines.join("\n");
    console.info("[Textbook TOC] falling back to AI with snippet:", tocSnippet);
    const aiUnits = await parseUnitsWithAi(tocSnippet, totalPages);
    console.info("[Textbook TOC] ai units:", aiUnits.map(unit => `${unit.unitLabel}(${unit.startPage}-${unit.endPage})`));
    if (aiUnits.length) {
      units = aiUnits;
    }
  }
  units = dedupeUnits(units);
  const footerOffset = detectPageOffsetFromFooters(printedPageNumbers);
  const pageOffset = (footerOffset ?? detectPageOffset(units, pageTexts)) ?? null;
  return {
    units,
    totalPages,
    pageOffset,
    printedPageNumbers
  };
};
