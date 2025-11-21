/**
 * LRC歌词解析器
 * 解析LRC格式的歌词文件并转换为JSON格式的片段数据
 */

export interface LrcLine {
  time: number; // 时间戳（毫秒）
  text: string; // 歌词文本
}

export interface Phrase {
  start: number; // 开始时间（秒）
  end: number; // 结束时间（秒）
  english: string; // 英文歌词
  chinese: string; // 中文翻译
}

/**
 * 解析LRC格式的歌词文件
 */
export function parseLrc(lrcContent: string): LrcLine[] {
  const lines: LrcLine[] = [];
  const contentLines = lrcContent.split('\n');

  for (const line of contentLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 匹配时间戳格式 [mm:ss.ms] 或 [mm:ss]
    const timeMatch = trimmedLine.match(/\[(\d{2}):(\d{2})(?:\.(\d{2}))?\]/);
    if (!timeMatch) continue;

    const minutes = parseInt(timeMatch[1], 10);
    const seconds = parseInt(timeMatch[2], 10);
    const milliseconds = timeMatch[3] ? parseInt(timeMatch[3], 10) * 10 : 0; // 将两位数转换为毫秒

    const totalMilliseconds = minutes * 60 * 1000 + seconds * 1000 + milliseconds;

    // 获取时间戳后的歌词文本
    const textStartIndex = trimmedLine.indexOf(']') + 1;
    const text = trimmedLine.substring(textStartIndex).trim();

    if (text) {
      lines.push({
        time: totalMilliseconds,
        text: text
      });
    }
  }

  // 按时间排序
  return lines.sort((a, b) => a.time - b.time);
}

/**
 * 检查文本是否主要包含中文字符
 */
function isMainlyChinese(text: string): boolean {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g);
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return false;
  return chineseChars ? chineseChars.length / totalChars > 0.5 : false;
}

/**
 * 将LRC解析结果转换为短语数组
 * 自动识别中英文，并按时间顺序配对
 */
export function convertLrcToPhrases(lrcLines: LrcLine[]): Phrase[] {
  const phrases: Phrase[] = [];

  for (let i = 0; i < lrcLines.length; i++) {
    const currentLine = lrcLines[i];
    const nextLine = lrcLines[i + 1];

    const isCurrentChinese = isMainlyChinese(currentLine.text);

    // 查找配对的英文/中文行
    let pairLine: LrcLine | null = null;
    if (nextLine && isMainlyChinese(nextLine.text) !== isCurrentChinese) {
      // 下一行是配对语言
      pairLine = nextLine;
      i++; // 跳过下一行，因为它已经被处理了
    } else if (i > 0 && isMainlyChinese(lrcLines[i - 1].text) !== isCurrentChinese) {
      // 上一行是配对语言
      pairLine = lrcLines[i - 1];
    }

    // 确定结束时间
    const endTime = nextLine ? nextLine.time / 1000 : currentLine.time / 1000 + 5; // 如果没有下一行，默认5秒

    if (pairLine) {
      // 有配对，创建包含中英文的短语
      const englishLine = isCurrentChinese ? pairLine : currentLine;
      const chineseLine = isCurrentChinese ? currentLine : pairLine;

      phrases.push({
        start: Math.min(currentLine.time, pairLine.time) / 1000,
        end: endTime,
        english: englishLine.text,
        chinese: chineseLine.text
      });
    } else {
      // 没有配对，创建单语言短语
      if (isCurrentChinese) {
        phrases.push({
          start: currentLine.time / 1000,
          end: endTime,
          english: "",
          chinese: currentLine.text
        });
      } else {
        phrases.push({
          start: currentLine.time / 1000,
          end: endTime,
          english: currentLine.text,
          chinese: ""
        });
      }
    }
  }

  return phrases;
}

/**
 * 完整的LRC到JSON转换函数
 */
export function parseLrcToJson(lrcContent: string): Phrase[] {
  const lrcLines = parseLrc(lrcContent);
  const phrases = convertLrcToPhrases(lrcLines);

  // 优化结束时间，确保没有重叠
  for (let i = 0; i < phrases.length - 1; i++) {
    if (phrases[i].end > phrases[i + 1].start) {
      phrases[i].end = phrases[i + 1].start;
    }
  }

  return phrases;
}

/**
 * 验证LRC格式
 */
export function validateLrcFormat(lrcContent: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = lrcContent.split('\n');

  if (lines.length === 0) {
    errors.push('文件内容为空');
  }

  let validLineCount = 0;
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const timeMatch = trimmedLine.match(/\[(\d{2}):(\d{2})(?:\.(\d{2}))?\]/);
    if (timeMatch) {
      validLineCount++;

      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);

      if (minutes > 99 || seconds > 59) {
        errors.push(`时间格式错误: [${timeMatch[1]}:${timeMatch[2]}]`);
      }
    } else {
      errors.push(`格式错误: ${trimmedLine}`);
    }
  }

  if (validLineCount === 0) {
    errors.push('没有找到有效的歌词行');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}