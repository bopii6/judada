import { PDFDocument } from "pdf-lib";

export interface PdfSplitOptions {
  pagesPerChunk: number;
  maxChunks?: number;
}

export interface PdfSplitChunk {
  buffer: Buffer;
  pageStart: number; // 1-based
  pageEnd: number; // inclusive, 1-based
  chunkIndex: number;
  totalPages: number;
}

/**
 * 将整本 PDF 拆分为多份小 PDF，便于后续作为素材上传。
 */
export const splitPdfIntoChunks = async (
  buffer: Buffer,
  options: PdfSplitOptions
): Promise<PdfSplitChunk[]> => {
  const doc = await PDFDocument.load(buffer);
  const totalPages = doc.getPageCount();
  if (totalPages === 0) {
    return [];
  }

  const pagesPerChunk = Math.max(1, Math.min(options.pagesPerChunk, totalPages));
  const maxChunks = options.maxChunks && options.maxChunks > 0 ? options.maxChunks : undefined;
  const chunks: PdfSplitChunk[] = [];

  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    if (maxChunks && chunks.length >= maxChunks) break;

    const endExclusive = Math.min(start + pagesPerChunk, totalPages);
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(
      doc,
      Array.from({ length: endExclusive - start }, (_, index) => start + index)
    );
    copiedPages.forEach(page => newDoc.addPage(page));

    const bytes = await newDoc.save();
    chunks.push({
      buffer: Buffer.from(bytes),
      pageStart: start + 1,
      pageEnd: endExclusive,
      chunkIndex: chunks.length,
      totalPages
    });
  }

  return chunks;
};

/**
 * 提取 PDF 中指定页码区间（包含起止页），返回新的 Buffer。
 */
export const extractPdfRange = async (
  buffer: Buffer,
  startPage: number,
  endPage: number
): Promise<{ buffer: Buffer; totalPages: number }> => {
  const doc = await PDFDocument.load(buffer);
  const totalPages = doc.getPageCount();
  if (totalPages === 0) {
    return { buffer: Buffer.alloc(0), totalPages };
  }

  const safeStart = Math.max(1, Math.min(startPage, totalPages));
  const safeEnd = Math.max(safeStart, Math.min(endPage, totalPages));
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(
    doc,
    Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => safeStart - 1 + index)
  );
  copiedPages.forEach(page => newDoc.addPage(page));
  const bytes = await newDoc.save();
  return {
    buffer: Buffer.from(bytes),
    totalPages
  };
};
