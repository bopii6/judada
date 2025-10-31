import { normalizeForCompare } from "./text";
import type { PlacementRecordInput, PlacementRecordResult, PlacementScoreResult, QuestionInput } from "./types";

const tierMappings = [
  { max: 7, tier: 1 },
  { max: 10, tier: 2 },
  { max: 13, tier: 3 },
  { max: 16, tier: 4 },
  { max: 19, tier: 5 }
];

/**
 * 将得分映射为推荐的 tier；若超过最后一个档位则默认为 tier 6。
 * 如需调整，请修改 tierMappings 数组。
 */
export const mapScoreToTier = (score: number): number => {
  for (const mapping of tierMappings) {
    if (score <= mapping.max) {
      return mapping.tier;
    }
  }
  return 6;
};

const computeBonus = (durationMs: number) => {
  if (durationMs <= 3000) return 0.3;
  if (durationMs <= 6000) return 0.1;
  return 0;
};

export const evaluatePlacement = (
  records: PlacementRecordInput[],
  questionMap: Map<string, QuestionInput>
): PlacementScoreResult => {
  const results: PlacementRecordResult[] = records.map(record => {
    const question = questionMap.get(record.questionId);
    let correct = false;
    if (question) {
      if (question.type === "type") {
        correct = normalizeForCompare(record.answerText) === normalizeForCompare(question.en);
        if (!correct && question.variants?.length) {
          correct = question.variants.some(variant => normalizeForCompare(variant) === normalizeForCompare(record.answerText));
        }
      } else {
        // tiles / listenTap / speak: 前端只要发送记录即视为是否成功
        correct = true;
      }
    }

    const baseScore = correct ? 1 : 0;
    const bonus = correct ? computeBonus(record.durationMs) : 0;
    return {
      ...record,
      correct,
      baseScore,
      bonus
    };
  });

  const score = results.reduce((total, current) => total + current.baseScore + current.bonus, 0);
  const recommendedTier = mapScoreToTier(score);

  return {
    records: results,
    totalQuestions: results.length,
    score,
    recommendedTier
  };
};
