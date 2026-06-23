import type { AppError, RuntimeRequest, RuntimeResponse } from "./types";

export function appError(code: AppError["code"], message: string): RuntimeResponse<never> {
  return { ok: false, error: { code, message } };
}

export function success<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data };
}

export async function sendRuntimeMessage<T>(request: RuntimeRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(request)) as RuntimeResponse<T> | undefined;
  if (!response) throw new Error("The extension did not return a response.");
  if (!response.ok) throw new Error(response.error.message);
  return response.data;
}

