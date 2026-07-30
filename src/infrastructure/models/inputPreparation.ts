const MAX_INPUT_CHARS = 6000;
const MAX_LINE_COUNT = 80;

export function prepareInputText(
  rawText: string,
  maxChars: number = MAX_INPUT_CHARS
): { text: string; wasCompressed: boolean } {
  const normalized = normalizeInputText(rawText);

  if (!normalized) {
    return {
      text: "",
      wasCompressed: false
    };
  }

  if (normalized.length <= maxChars) {
    return {
      text: normalized,
      wasCompressed: false
    };
  }

  const compressed = compressLongText(normalized, maxChars);
  return {
    text: compressed || normalized.slice(0, maxChars),
    wasCompressed: true
  };
}

export function normalizeInputText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function compressLongText(text: string, charLimit: number): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return text.slice(0, charLimit);
  }

  const scoredLines = lines.map((line, index) => ({
    line,
    index,
    score: scoreLine(line, index, lines.length)
  }));

  const selectedIndexes = new Set<number>();
  const candidateIndexes = scoredLines
    .slice()
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.min(MAX_LINE_COUNT, scoredLines.length))
    .map((item) => item.index);

  for (const index of candidateIndexes) {
    selectedIndexes.add(index);
  }

  for (let index = 0; index < Math.min(4, lines.length); index += 1) {
    selectedIndexes.add(index);
  }

  for (let index = Math.max(0, lines.length - 4); index < lines.length; index += 1) {
    selectedIndexes.add(index);
  }

  const selectedLines = Array.from(selectedIndexes)
    .sort((a, b) => a - b)
    .map((index) => lines[index]);

  const prefix = "以下内容较长，已保守截取标题、关键段落、数字和结论线索：";
  const assembled = [prefix, ...selectedLines].join("\n").trim();

  if (assembled.length <= charLimit) {
    return assembled;
  }

  return trimToCharLimit([prefix, ...selectedLines], charLimit);
}

function scoreLine(line: string, index: number, totalLines: number): number {
  let score = 0;
  const normalized = line.toLowerCase();

  if (index < 3) {
    score += 4;
  }

  if (index >= totalLines - 3) {
    score += 3;
  }

  if (/\d/.test(line)) {
    score += 3;
  }

  if (/[：:]/.test(line)) {
    score += 2;
  }

  if (line.length >= 18 && line.length <= 120) {
    score += 2;
  }

  if (/^(总结|结论|核心|重点|观点|风险|建议|数据|拆解|全文|摘要)/.test(line)) {
    score += 4;
  }

  if (/(因此|所以|意味着|说明|建议|可能|风险|结论|判断|验证)/.test(line)) {
    score += 3;
  }

  if (/(a股|美股|港股|指数|收盘|跌幅|涨幅|财报|估值|模型|产品|用户|收入)/.test(normalized)) {
    score += 2;
  }

  return score;
}

function trimToCharLimit(lines: string[], charLimit: number): string {
  const output: string[] = [];
  let currentLength = 0;

  for (const line of lines) {
    const nextLength = currentLength === 0 ? line.length : currentLength + 1 + line.length;

    if (nextLength <= charLimit) {
      output.push(line);
      currentLength = nextLength;
      continue;
    }

    const remaining = charLimit - currentLength - (currentLength === 0 ? 0 : 1);
    if (remaining > 24) {
      output.push(`${line.slice(0, remaining - 1)}…`);
    }
    break;
  }

  return output.join("\n").trim();
}
