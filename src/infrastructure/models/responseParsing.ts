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
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const extracted = extractJsonObjectString(cleaned);
    if (!extracted) {
      return null;
    }

    try {
      return JSON.parse(extracted);
    } catch {
      const repaired = repairLooseJson(extracted);
      if (!repaired) {
        return null;
      }

      try {
        return JSON.parse(repaired);
      } catch {
        return null;
      }
    }
  }
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

function extractJsonObjectString(input: string): string | null {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return input.slice(start, end + 1).trim();
}

function repairLooseJson(input: string): string | null {
  const normalizedQuotes = input
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");

  const withoutTrailingCommas = normalizedQuotes.replace(/,\s*([}\]])/g, "$1");
  return withoutTrailingCommas.trim() || null;
}
