#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import pdfParse from "pdf-parse";

import { jsonCourseImportSchema, type JsonCourseImportPayload } from "../src/types/jsonCourseImport";

interface UnitConfig {
  sequence: number;
  title: string;
  startPage: number;
  endPage: number;
}

interface SentenceEntry {
  text: string;
  pageNumber: number;
}

const usage = `
Usage:
  pnpm --filter server tsx scripts/pdf-to-json.ts --pdf "<file>" --unit "1|Unit 1|5-20" [--unit "..."] [--rounds 4] [--per-round 16] [--output result.json]

Options:
  --pdf         Path to the source PDF file.
  --unit        Unit definition in the format "sequence|title|startPage-endPage".
                Repeat this flag to describe multiple units.
  --rounds      Number of rounds per unit (default: 4).
  --per-round   Number of sentences per round (default: 16).
  --output      Optional output JSON file path. Prints to stdout when omitted.
`.trim();

const parseArguments = (): {
  pdfPath: string;
  units: UnitConfig[];
  rounds: number;
  perRound: number;
  outputPath?: string;
} => {
  const args = process.argv.slice(2);
  const units: UnitConfig[] = [];
  let pdfPath = "";
  let outputPath: string | undefined;
  let rounds = 4;
  let perRound = 16;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--pdf":
        pdfPath = args[++i] ?? "";
        break;
      case "--output":
        outputPath = args[++i];
        break;
      case "--rounds":
        rounds = Number(args[++i]);
        break;
      case "--per-round":
        perRound = Number(args[++i]);
        break;
      case "--unit":
        units.push(parseUnitArg(args[++i]));
        break;
      case "--help":
      case "-h":
        console.log(usage);
        process.exit(0);
        break;
      default:
        console.warn(`Unknown argument "${arg}" will be ignored`);
    }
  }

  if (!pdfPath) {
    throw new Error("Missing --pdf argument.\n\n" + usage);
  }

  if (!units.length) {
    throw new Error("Please provide at least one --unit definition.\n\n" + usage);
  }

  if (!Number.isFinite(rounds) || rounds <= 0) {
    throw new Error("--rounds must be a positive integer");
  }

  if (!Number.isFinite(perRound) || perRound <= 0) {
    throw new Error("--per-round must be a positive integer");
  }

  return { pdfPath, units, rounds, perRound, outputPath };
};

const parseUnitArg = (value?: string): UnitConfig => {
  if (!value) {
    throw new Error("Empty --unit argument detected");
  }
  const parts = value.split("|").map(part => part.trim());
  if (parts.length !== 3) {
    throw new Error(`Invalid unit definition "${value}". Expected "sequence|title|start-end"`);
  }
  const [sequenceText, title, range] = parts;
  const [startText, endText] = range.split("-").map(part => part.trim());
  const sequence = Number(sequenceText);
  const startPage = Number(startText);
  const endPage = Number(endText);
  if (!title) {
    throw new Error(`Unit title is missing in "${value}"`);
  }
  if (!Number.isFinite(sequence) || sequence <= 0) {
    throw new Error(`Invalid unit sequence in "${value}"`);
  }
  if (!Number.isFinite(startPage) || !Number.isFinite(endPage) || startPage <= 0 || endPage < startPage) {
    throw new Error(`Invalid page range in "${value}"`);
  }
  return { sequence, title, startPage, endPage };
};

const normalizeSentence = (sentence: string): string =>
  sentence
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .trim();

const isValidSentence = (sentence: string): boolean => {
  if (!sentence) return false;
  if (sentence.length < 8 || sentence.length > 220) return false;
  const letters = sentence.match(/[a-zA-Z]/g)?.length ?? 0;
  if (letters < 5) return false;
  const noSpaceLength = sentence.replace(/\s+/g, "").length;
  if (!noSpaceLength) return false;
  if (letters / noSpaceLength < 0.6) return false;
  const words = sentence.split(/\s+/).filter(Boolean);
  return words.length >= 3;
};

const extractEnglishCandidates = (text: string): string[] => {
  if (!text.trim()) {
    return [];
  }
  const normalized = text.replace(/\r?\n+/g, " ");
  const matches = normalized.match(/[A-Z][^.!?]{3,200}[.!?]/g) ?? [];
  return matches.map(match => {
    const stripped = match.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
    return stripped.trim();
  });
};

const collectSentencesForUnit = (
  pages: string[],
  config: UnitConfig
): SentenceEntry[] => {
  const results: SentenceEntry[] = [];
  const dedup = new Set<string>();
  const maxPageIndex = pages.length;
  const endPage = Math.min(config.endPage, maxPageIndex);

  for (let page = config.startPage; page <= endPage; page++) {
    const pageText = pages[page - 1] ?? "";
    const candidates = extractEnglishCandidates(pageText);
    for (const candidate of candidates) {
      const normalized = normalizeSentence(candidate);
      if (!isValidSentence(normalized)) continue;
      const key = normalized.toLowerCase();
      if (dedup.has(key)) continue;
      dedup.add(key);
      const sentence = tokenEndsSentence(normalized) ? normalized : `${normalized}.`;
      results.push({
        text: sentence,
        pageNumber: page
      });
    }
  }

  return results;
};

const tokenEndsSentence = (value: string): boolean => /[.!?]"?$/.test(value.trim());

const chunkIntoRounds = (
  sentences: SentenceEntry[],
  roundCount: number,
  perRound: number
) => {
  const required = roundCount * perRound;
  const selected = sentences.slice(0, required);
  const rounds: Array<{ title: string; roundNumber: number; sentences: SentenceEntry[] }> = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const start = roundIndex * perRound;
    const roundSentences = selected.slice(start, start + perRound);
    if (!roundSentences.length) {
      break;
    }
    rounds.push({
      title: `第 ${roundIndex + 1} 轮`,
      roundNumber: roundIndex + 1,
      sentences: roundSentences
    });
  }
  return rounds;
};

const buildCourseJson = (
  pdfPath: string,
  pages: string[],
  units: UnitConfig[],
  roundCount: number,
  perRound: number
): JsonCourseImportPayload => {
  const unitPayloads = units.map(unit => {
    const sentences = collectSentencesForUnit(pages, unit);
    if (!sentences.length) {
      console.warn(
        `[warn] No sentences extracted for unit "${unit.title}" (pages ${unit.startPage}-${unit.endPage})`
      );
    }
    const rounds = chunkIntoRounds(sentences, roundCount, perRound).map(round => ({
      title: round.title,
      roundNumber: round.roundNumber,
      sentences: round.sentences.map((item, index) => ({
        title: `${round.title} · 句子 ${index + 1}`,
        en: item.text,
        cn: "",
        pageNumber: item.pageNumber
      }))
    }));
    return {
      sequence: unit.sequence,
      title: unit.title,
      rounds
    };
  });

  return {
    packageSummary: `Auto generated from ${path.basename(pdfPath)}`,
    rounds: roundCount,
    sentencesPerRound: perRound,
    units: unitPayloads
  };
};

const run = async () => {
  const { pdfPath, units, rounds, perRound, outputPath } = parseArguments();
  const buffer = await fs.promises.readFile(pdfPath);
  const parsed = await pdfParse(buffer);
  const pages = parsed.text.split("\f");

  const courseJson = buildCourseJson(pdfPath, pages, units, rounds, perRound);
  const validated = jsonCourseImportSchema.parse(courseJson);
  const serialized = JSON.stringify(validated, null, 2);

  if (outputPath) {
    await fs.promises.writeFile(outputPath, serialized, "utf8");
    console.log(
      `✅ JSON exported to ${path.resolve(outputPath)} (${validated.units.length} units)`
    );
  } else {
    console.log(serialized);
  }
};

run().catch(error => {
  console.error("Failed to export JSON:", error);
  process.exit(1);
});
