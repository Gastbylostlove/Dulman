import { Message } from "./types";

const BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw data;
  return data as T;
}

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export interface AuthResult {
  access_token: string;
  refresh_token: string;
  login_id: string;
  current_device_id: string;
  active_chat_id: number | null;
}

export interface ChatResult {
  chat_id: number;
  invite_code: string;
  status: string;
}

export interface ActiveChatResult {
  active_chat_id: number | null;
  status: string | null;
  user_a_id: string | null;
  user_b_id: string | null;
}

export interface BackendMessage {
  id?: number;
  message_id?: number;
  sender_id: string;
  type: "text" | "media";
  text_content?: string;
  permission_type?: "once" | "replay_once" | "keep";
  view_count?: number;
  media?: Array<{ url: string; mime_type: string }>;
  created_at: string;
}

export function toFrontendMessage(msg: BackendMessage, myLoginId: string): Message {
  const id = String(msg.id ?? msg.message_id ?? Math.random());
  const time = new Date(msg.created_at).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const rawPerm = msg.permission_type;
  const permissionType = rawPerm === "replay_once" ? "replay" : rawPerm;
  return {
    id,
    sender: msg.sender_id === myLoginId ? "me" : "partner",
    text: msg.text_content || undefined,
    time,
    isMedia: msg.type === "media",
    mediaUrl: msg.media?.[0]?.url,
    permissionType: permissionType as "once" | "replay" | "keep" | undefined,
    revealed: permissionType === "keep",
    clicksCount: msg.view_count ?? 0,
  };
}

export const api = {
  signup: (login_id: string, password: string) =>
    request<{ login_id: string }>("/users", {
      method: "POST",
      body: JSON.stringify({ login_id, password }),
    }),

  login: (login_id: string, password: string, device_id: string) =>
    request<AuthResult>("/auth/tokens", {
      method: "POST",
      body: JSON.stringify({ login_id, password, device_id }),
    }),

  getActiveChat: (token: string) =>
    request<ActiveChatResult>("/chats/active", {
      headers: auth(token),
    }),

  createChat: (token: string) =>
    request<ChatResult>("/chats", {
      method: "POST",
      headers: auth(token),
    }),

  joinChat: (token: string, invite_code: string) =>
    request<{ chat_id: number; status: string }>("/chat-participants", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ invite_code }),
    }),

  listMessages: (token: string, chat_id: number) =>
    request<{ messages: BackendMessage[] }>(`/chats/${chat_id}/messages`, {
      headers: auth(token),
    }),

  sendText: (token: string, chat_id: number, text_content: string) =>
    request<BackendMessage>("/messages", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ chat_id, type: "text", text_content }),
    }),

  resetChat: (token: string, chat_id: number) =>
    request<{ chat_id: number }>("/chat-reset-logs", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ chat_id }),
    }),

  leaveChat: (token: string, chat_id: number) =>
    request<{ chat_id: number; status: string }>("/chat-terminations", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ chat_id }),
    }),
};
