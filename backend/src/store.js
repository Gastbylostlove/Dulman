/**
 * Creates an in-memory repository that mirrors the Postgres storage contract.
 *
 * @returns {object}
 */
export function createMemoryStore() {
  const state = {
    users: new Map(),
    chats: new Map(),
    chatsByInviteCode: new Map(),
    messages: new Map(),
    media: new Map(),
    resetLogs: new Map(),
    authFailures: new Map(),
    inviteFailures: new Map(),
    nextChatId: 1,
    nextMessageId: 1,
    nextMediaId: 1,
    nextResetLogId: 1,
  };

  return {
    authFailures: state.authFailures,
    inviteFailures: state.inviteFailures,
    async withTransaction(work) {
      return work(this);
    },

    async findUser(loginId) {
      return state.users.get(loginId) ?? null;
    },

    async insertUser(record) {
      state.users.set(record.login_id, { ...record });
      return state.users.get(record.login_id);
    },

    async updateUser(loginId, patch) {
      const current = state.users.get(loginId);
      if (!current) return null;
      Object.assign(current, patch);
      return current;
    },

    async findChatById(chatId) {
      return state.chats.get(chatId) ?? null;
    },

    async findChatByInviteCode(inviteCode) {
      const chatId = state.chatsByInviteCode.get(inviteCode);
      return chatId ? state.chats.get(chatId) ?? null : null;
    },

    async findActiveChatByParticipant(loginId) {
      for (const chat of state.chats.values()) {
        if (chat.status === "active" && (chat.user_a_id === loginId || chat.user_b_id === loginId)) {
          return chat;
        }
      }
      return null;
    },

    async insertChat(record) {
      const chat = { ...record, id: state.nextChatId++ };
      state.chats.set(chat.id, chat);
      state.chatsByInviteCode.set(chat.invite_code, chat.id);
      return chat;
    },

    async updateChat(chatId, patch) {
      const current = state.chats.get(chatId);
      if (!current) return null;
      Object.assign(current, patch);
      return current;
    },

    async listMessagesByChatId(chatId) {
      return [...state.messages.values()].filter((message) => message.chat_id === chatId);
    },

    async findMessageById(messageId) {
      return state.messages.get(messageId) ?? null;
    },

    async insertMessage(record) {
      const message = { ...record, id: state.nextMessageId++ };
      state.messages.set(message.id, message);
      return message;
    },

    async updateMessage(messageId, patch) {
      const current = state.messages.get(messageId);
      if (!current) return null;
      Object.assign(current, patch);
      return current;
    },

    async listMediaByMessageId(messageId) {
      return [...state.media.values()].filter((media) => media.message_id === messageId);
    },

    async insertMedia(record) {
      const media = { ...record, id: state.nextMediaId++ };
      state.media.set(media.id, media);
      return media;
    },

    async insertResetLog(record) {
      const resetLog = { ...record, id: state.nextResetLogId++ };
      state.resetLogs.set(resetLog.id, resetLog);
      return resetLog;
    },
  };
}
