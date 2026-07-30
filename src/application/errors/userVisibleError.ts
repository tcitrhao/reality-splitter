export class UserVisibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserVisibleError";
  }
}

export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export function toUserMessage(error: unknown): string {
  if (error instanceof UserVisibleError) {
    return error.message;
  }

  if (isTimeoutError(error)) {
    return "这次请求被中断了。可能是网络超时、页面刷新或模型服务响应太慢，可以再试一次。";
  }

  if (error instanceof Error && error.message) {
    if (/aborted|abort/i.test(error.message)) {
      return "这次请求被中断了。可能是网络超时、页面刷新或模型服务响应太慢，可以再试一次。";
    }

    return error.message;
  }

  return "这次分析失败了，可以稍后再试。";
}
