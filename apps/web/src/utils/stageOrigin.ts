import type { CourseStage } from "../api/courses";

const stripExtension = (name: string) => name.replace(/\.[a-z0-9]+$/i, "");

const humanize = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, char => char.toUpperCase());

export const formatStageOriginLabel = (stage: CourseStage): string | null => {
  const labelParts: string[] = [];
  if (stage.unitName) {
    labelParts.push(stage.unitName);
  } else if (typeof stage.unitNumber === "number") {
    labelParts.push(`Unit ${stage.unitNumber}`);
  }

  if (typeof stage.pageNumber === "number") {
    labelParts.push(`Page ${stage.pageNumber}`);
  } else if (stage.sourceAssetName) {
    labelParts.push(humanize(stripExtension(stage.sourceAssetName)));
  } else if (typeof stage.sourceAssetOrder === "number") {
    labelParts.push(`Page ${stage.sourceAssetOrder + 1}`);
  }

  if (!labelParts.length) {
    return null;
  }
  return labelParts.join(" · ");
};
