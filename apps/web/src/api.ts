export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("X-Requested-With", "LabLink");
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Chưa kết nối được máy chủ. Hãy kiểm tra API đang chạy ở cổng 8000.",
      0,
    );
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("lablink:unauthorized"));
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map(
                (e: { msg: string; loc?: string[] }) =>
                  `${e.loc?.slice(1).join(".") || "Dữ liệu"}: ${e.msg}`,
              )
              .join("; ")
          : "Thao tác chưa hoàn tất. Vui lòng thử lại.";
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const json = (method: string, data: unknown): RequestInit => ({
  method,
  body: JSON.stringify(data),
});
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Đã xảy ra lỗi. Vui lòng thử lại.";
