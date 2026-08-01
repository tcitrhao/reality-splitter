import type { WebsiteContent } from "../website/content";

const DEFAULT_REPOSITORY = "tcitrhao/reality-splitter";
const CONTENT_PATH = "content/website-content.json";
const CONTENT_BRANCH = "main";
const API_ROOT = "https://api.github.com";
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
  sha: string;
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

  return { sha, commitUrl: result.commit?.html_url };
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

async function githubRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
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
    throw new Error(await describeGitHubError(response));
  }

  return (await response.json()) as T;
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
