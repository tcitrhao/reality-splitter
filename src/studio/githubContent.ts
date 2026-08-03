import type { WebsiteContent } from "../website/content";

const DEFAULT_REPOSITORY = "tcitrhao/reality-splitter";
const CONTENT_PATH = "content/website-content.json";
const CONTENT_BRANCH = "main";
const DEFAULT_API_ROOT = "https://api.github.com";
const TOKEN_STORAGE_KEY = "reality-splitter-studio-token";

export const tokenSettingsUrl =
  "https://github.com/settings/personal-access-tokens/new";

export interface GitHubIdentity {
  login: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface GitHubContentSnapshot {
  content: WebsiteContent;
  sha: string;
}

export interface GitHubPublishResult {
  commitUrl?: string;
  content: WebsiteContent;
  sha: string;
}

export class GitHubWriteAccessError extends Error {
  constructor() {
    super(
      "GitHub 拒绝了发布请求：当前 Token 没有 reality-splitter 的写入权限。请将仓库权限中的 Contents 设置为 Read and write，然后用更新后的 Token 重新发布。"
    );
    this.name = "GitHubWriteAccessError";
  }
}

interface GitHubUserResponse {
  avatar_url: string;
  html_url: string;
  login: string;
}

interface GitHubFileResponse {
  content: string;
  encoding: string;
  sha: string;
  type: string;
}

interface GitHubUpdateResponse {
  commit?: { html_url?: string };
  content?: { sha?: string };
}

export function readSessionToken(): string {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY)?.trim() || "";
}

export function storeSessionToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

export function clearSessionToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function authenticateGitHub(token: string): Promise<GitHubIdentity> {
  const user = await githubRequest<GitHubUserResponse>("/user", token);
  return {
    login: user.login,
    avatarUrl: user.avatar_url,
    profileUrl: user.html_url
  };
}

export async function loadGitHubContent(token: string): Promise<GitHubContentSnapshot> {
  const file = await githubRequest<GitHubFileResponse>(
    `${contentEndpoint()}?ref=${encodeURIComponent(CONTENT_BRANCH)}`,
    token
  );

  if (file.type !== "file" || file.encoding !== "base64") {
    throw new Error("GitHub 返回了无法识别的内容格式。");
  }

  return {
    content: JSON.parse(decodeUtf8Base64(file.content)) as WebsiteContent,
    sha: file.sha
  };
}

export async function publishGitHubContent(params: {
  content: WebsiteContent;
  sha: string;
  token: string;
}): Promise<GitHubPublishResult> {
  const result = await githubRequest<GitHubUpdateResponse>(contentEndpoint(), params.token, {
    method: "PUT",
    body: JSON.stringify({
      branch: CONTENT_BRANCH,
      content: encodeUtf8Base64(`${JSON.stringify(params.content, null, 2)}\n`),
      message: "content: publish website from studio",
      sha: params.sha
    })
  });

  const sha = result.content?.sha;
  if (!sha) {
    throw new Error("内容已提交，但 GitHub 没有返回新的文件版本。");
  }

  return { content: params.content, sha, commitUrl: result.commit?.html_url };
}

export async function publishGitHubContentSafely(params: {
  baseContent: WebsiteContent;
  content: WebsiteContent;
  sha: string;
  token: string;
}): Promise<GitHubPublishResult> {
  const latest = await loadGitHubContent(params.token);
  const content = latest.sha === params.sha
    ? params.content
    : mergeWebsiteContent(params.baseContent, params.content, latest.content);

  try {
    return await publishGitHubContent({
      content,
      sha: latest.sha,
      token: params.token
    });
  } catch (error) {
    if (!(error instanceof GitHubRequestError) || error.status !== 409) {
      throw error;
    }

    const refreshed = await loadGitHubContent(params.token);
    return publishGitHubContent({
      content: mergeWebsiteContent(latest.content, content, refreshed.content),
      sha: refreshed.sha,
      token: params.token
    });
  }
}

export function mergeWebsiteContent(
  base: WebsiteContent,
  local: WebsiteContent,
  remote: WebsiteContent
): WebsiteContent {
  const merged = mergeValue(base, local, remote) as WebsiteContent;
  merged.iterations = mergeKeyedItems(
    base.iterations,
    local.iterations,
    remote.iterations,
    (item) => item.version
  );
  merged.meditations = mergeKeyedItems(
    base.meditations,
    local.meditations,
    remote.meditations,
    (item) => item.index
  );
  return merged;
}

export function encodeUtf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

export function decodeUtf8Base64(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function contentEndpoint(): string {
  const repository = import.meta.env?.VITE_GITHUB_REPOSITORY?.trim() || DEFAULT_REPOSITORY;
  return `/repos/${repository}/contents/${CONTENT_PATH}`;
}

function mergeKeyedItems<T extends object>(
  base: T[],
  local: T[],
  remote: T[],
  getKey: (item: T) => string
): T[] {
  const baseByKey = new Map(base.map((item) => [getKey(item), item]));
  const localByKey = new Map(local.map((item) => [getKey(item), item]));
  const remoteByKey = new Map(remote.map((item) => [getKey(item), item]));
  const localAdditions = local.filter((item) => !baseByKey.has(getKey(item)));
  const localRecoveries = local.filter((item) => {
    const key = getKey(item);
    const baseItem = baseByKey.get(key);
    return Boolean(baseItem) && !remoteByKey.has(key) && !sameValue(item, baseItem);
  });
  const mergedRemote = remote.flatMap((remoteItem) => {
    const key = getKey(remoteItem);
    const baseItem = baseByKey.get(key);
    const localItem = localByKey.get(key);

    if (baseItem && !localItem) {
      return [];
    }
    if (!localItem) {
      return [remoteItem];
    }
    if (!baseItem) {
      return [localItem];
    }
    return [mergeValue(baseItem, localItem, remoteItem) as T];
  });
  const remoteKeys = new Set(remoteByKey.keys());

  return [
    ...localAdditions.filter((item) => !remoteKeys.has(getKey(item))),
    ...localRecoveries,
    ...mergedRemote
  ];
}

function mergeValue(base: unknown, local: unknown, remote: unknown): unknown {
  if (sameValue(local, base)) {
    return structuredClone(remote);
  }
  if (sameValue(remote, base) || !isRecord(base) || !isRecord(local) || !isRecord(remote)) {
    return structuredClone(local);
  }

  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  return Object.fromEntries(
    Array.from(keys, (key) => [key, mergeValue(base[key], local[key], remote[key])])
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function githubRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiRoot()}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers
    }
  });

  if (!response.ok) {
    if (response.status === 403 && init.method === "PUT" && path.includes("/contents/")) {
      throw new GitHubWriteAccessError();
    }
    throw new GitHubRequestError(response.status, await describeGitHubError(response));
  }

  return (await response.json()) as T;
}

class GitHubRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubRequestError";
    this.status = status;
  }
}

function apiRoot(): string {
  return (
    import.meta.env?.VITE_GITHUB_API_ROOT?.trim() || DEFAULT_API_ROOT
  ).replace(/\/$/, "");
}

async function describeGitHubError(response: Response): Promise<string> {
  if (response.status === 401) {
    return "登录凭证无效或已经过期。";
  }
  if (response.status === 403) {
    return "该凭证没有写入权限，请为仓库开启 Contents: Read and write。";
  }
  if (response.status === 404) {
    return "无法读取官网内容，请确认凭证已授权 reality-splitter 仓库。";
  }
  if (response.status === 409) {
    return "远程内容已经变化，请重新载入后再编辑，避免覆盖更新。";
  }
  if (response.status === 422) {
    return "GitHub 拒绝了这次提交，请重新载入后再试。";
  }

  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message || `GitHub 请求失败（${response.status}）。`;
  } catch {
    return `GitHub 请求失败（${response.status}）。`;
  }
}
