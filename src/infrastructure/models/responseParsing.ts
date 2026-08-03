export function normalizeModelContent(
  content: string | Array<{ type?: string; text?: string }> | undefined
): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (item.type === "text" || !item.type ? item.text || "" : ""))
      .join("")
      .trim();
  }

  return "";
}

export function safeParseJson(rawContent: string): unknown | null {
  const cleaned = rawContent
    .replace(/^\uFEFF/, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const candidates = collectJsonCandidates(cleaned);

  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

export async function safeReadJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function readErrorMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await safeReadJson(response)) as
      | { error?: { message?: string } | string; message?: string }
      | null;

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }

    if (typeof payload?.error === "object" && typeof payload.error?.message === "string") {
      return payload.error.message.trim();
    }

    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  }

  const rawText = await response.text().catch(() => "");
  const normalizedText = rawText.replace(/\s+/g, " ").trim();

  if (normalizedText) {
    return `${response.status} ${response.statusText}`.trim()
      ? `${response.status} ${response.statusText}：${normalizedText.slice(0, 280)}`
      : normalizedText.slice(0, 280);
  }

  return response.status ? `${response.status} ${response.statusText}`.trim() : null;
}

function collectJsonCandidates(input: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) {
      candidates.add(trimmed);
    }
  };

  add(input);

  for (const match of input.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    add(match[1]);
  }

  add(extractBalancedJson(input));

  const repairedInput = repairLooseJson(input);
  if (repairedInput && repairedInput !== input) {
    add(repairedInput);
    add(extractBalancedJson(repairedInput));
  }

  return [...candidates];
}

function repairLooseJson(input: string): string | null {
  let output = "";
  let inString = false;
  let stringDelimiter: '"' | "curly" | null = null;
  let escaped = false;

  for (const character of input) {
    if (inString) {
      if (escaped) {
        output += character;
        escaped = false;
        continue;
      }

      if (character === "\\") {
        output += character;
        escaped = true;
        continue;
      }

      if (
        (stringDelimiter === '"' && character === '"') ||
        (stringDelimiter === "curly" && /[\u201c\u201d]/.test(character))
      ) {
        output += '"';
        inString = false;
        stringDelimiter = null;
        continue;
      }

      if (character === "\n") {
        output += "\\n";
      } else if (character === "\r") {
        output += "\\r";
      } else if (character === "\t") {
        output += "\\t";
      } else if (character.charCodeAt(0) < 0x20) {
        output += `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
      } else {
        output += character;
      }
      continue;
    }

    if (character === '"') {
      output += character;
      inString = true;
      stringDelimiter = '"';
    } else if (/[\u201c\u201d]/.test(character)) {
      output += '"';
      inString = true;
      stringDelimiter = "curly";
    } else if (character === "：") {
      output += ":";
    } else if (character === "，") {
      output += ",";
    } else {
      output += character;
    }
  }

  const withoutTrailingCommas = removeTrailingCommas(output);
  return withoutTrailingCommas.trim() || null;
}

function parseJsonCandidate(candidate: string): unknown | null {
  for (const value of [candidate, repairLooseJson(candidate)]) {
    if (!value) {
      continue;
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === "string") {
        const nested = parsed.trim();
        if (nested.startsWith("{") || nested.startsWith("[")) {
          return parseJsonCandidate(nested);
        }
      }
      return parsed;
    } catch {
      // Try the next conservative repair candidate.
    }
  }

  return null;
}

function extractBalancedJson(input: string): string | null {
  const start = input.search(/[\[{]/);
  if (start === -1) {
    return null;
  }

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const character = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{" || character === "[") {
      stack.push(character);
    } else if (character === "}" || character === "]") {
      const expected = character === "}" ? "{" : "[";
      if (stack.pop() !== expected) {
        return null;
      }

      if (stack.length === 0) {
        return input.slice(start, index + 1).trim();
      }
    }
  }

  return null;
}

function removeTrailingCommas(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      output += character;
      inString = true;
      continue;
    }

    if (character === ",") {
      let cursor = index + 1;
      while (/\s/.test(input[cursor] ?? "")) {
        cursor += 1;
      }

      if (input[cursor] === "}" || input[cursor] === "]") {
        continue;
      }
    }

    output += character;
  }

  return output;
}
