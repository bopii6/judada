import type { JsonCourseImportPayload, JsonRound, JsonSentence, JsonUnit } from "../types/jsonCourseImport";

export interface CsvRow {
  unit: string;
  unit_title: string;
  round: string;
  round_title?: string;
  en: string;
  cn: string;
  page?: string;
}

/**
 * 解析 CSV 文本为行数组
 * 支持带引号的字段（处理字段内的逗号和换行）
 */
export function parseCsvText(csvText: string): CsvRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("CSV 文件至少需要包含表头和一行数据");
  }

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map(h => h.toLowerCase().trim());

  // 验证必需的列
  const requiredColumns = ["unit", "unit_title", "round", "en", "cn"];
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));
  if (missingColumns.length > 0) {
    throw new Error(`CSV 缺少必需的列: ${missingColumns.join(", ")}`);
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? "";
    });

    // 跳过空行
    if (!row.en?.trim()) continue;

    rows.push({
      unit: row.unit ?? "",
      unit_title: row.unit_title ?? "",
      round: row.round ?? "",
      round_title: row.round_title ?? undefined,
      en: row.en ?? "",
      cn: row.cn ?? "",
      page: row.page
    });
  }

  if (rows.length === 0) {
    throw new Error("CSV 文件中没有有效的数据行");
  }

  return rows;
}

/**
 * 解析单行 CSV，处理引号包裹的字段
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // 转义的引号
          current += '"';
          i++;
        } else {
          // 结束引号
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);

  return result;
}

/**
 * 将 CSV 行数组转换为 JSON 导入格式
 * 注意：roundNumber 从 1 开始，与 CSV 中的 round 列一致
 */
export function csvRowsToJsonPayload(rows: CsvRow[]): JsonCourseImportPayload {
  // 按单元和轮次分组
  const unitMap = new Map<number, {
    title: string;
    rounds: Map<number, { title: string; sentences: JsonSentence[] }>;
  }>();

  for (const row of rows) {
    const unitNum = parseInt(row.unit, 10);
    const roundNum = parseInt(row.round, 10);

    if (isNaN(unitNum) || unitNum < 1) {
      throw new Error(`无效的单元序号: "${row.unit}"，行内容: ${row.en.substring(0, 30)}...`);
    }
    if (isNaN(roundNum) || roundNum < 1) {
      throw new Error(`无效的轮次序号: "${row.round}"，行内容: ${row.en.substring(0, 30)}...`);
    }

    if (!unitMap.has(unitNum)) {
      unitMap.set(unitNum, {
        title: row.unit_title || `Unit ${unitNum}`,
        rounds: new Map()
      });
    }

    const unitData = unitMap.get(unitNum)!;
    if (!unitData.rounds.has(roundNum)) {
      // 使用 round_title 作为轮次标题，如果没有则使用默认值
      const roundTitle = row.round_title?.trim() || `Round ${roundNum}`;
      unitData.rounds.set(roundNum, { title: roundTitle, sentences: [] });
    }

    // 处理页码，移除 "P", "p", "页" 前缀
    let pageNumber: number | undefined;
    if (row.page) {
      const cleanedPage = row.page.replace(/^[Pp页]/, "").trim();
      const parsedPage = parseInt(cleanedPage, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        pageNumber = parsedPage;
      }
    }

    const sentence: JsonSentence = {
      en: row.en,
      cn: row.cn || undefined,
      pageNumber: pageNumber
    };

    unitData.rounds.get(roundNum)!.sentences.push(sentence);
  }

  // 转换为 JsonCourseImportPayload 格式
  const units: JsonUnit[] = [];
  const sortedUnitNums = Array.from(unitMap.keys()).sort((a, b) => a - b);

  for (const unitNum of sortedUnitNums) {
    const unitData = unitMap.get(unitNum)!;
    const rounds: JsonRound[] = [];
    const sortedRoundNums = Array.from(unitData.rounds.keys()).sort((a, b) => a - b);

    for (const roundNum of sortedRoundNums) {
      const roundData = unitData.rounds.get(roundNum)!;
      rounds.push({
        roundNumber: roundNum, // 保持原始轮次编号（从1开始）
        title: roundData.title,
        sentences: roundData.sentences
      });
    }

    units.push({
      sequence: unitNum,
      title: unitData.title,
      rounds
    });
  }

  // 确保至少有一个单元
  if (units.length === 0) {
    throw new Error("CSV 文件中没有有效的单元数据");
  }

  // 计算统计信息
  const totalRounds = units.reduce((sum, u) => sum + u.rounds.length, 0);
  const avgSentencesPerRound = Math.round(
    rows.length / (totalRounds || 1)
  );

  // 使用类型断言确保 units 是非空数组
  const nonEmptyUnits = units as [JsonUnit, ...JsonUnit[]];

  return {
    packageSummary: `CSV Import: ${units.length} units, ${totalRounds} rounds, ${rows.length} sentences`,
    rounds: Math.max(...units.map(u => u.rounds.length)),
    sentencesPerRound: avgSentencesPerRound,
    units: nonEmptyUnits
  };
}

/**
 * 解析 CSV 文本并转换为 JSON 导入格式
 */
export function parseCsvToJsonPayload(csvText: string): JsonCourseImportPayload {
  const rows = parseCsvText(csvText);
  return csvRowsToJsonPayload(rows);
}

