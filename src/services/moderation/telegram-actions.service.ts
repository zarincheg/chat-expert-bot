import type { Api } from "grammy";

export class TelegramModerationActions {
  constructor(private readonly api: Api) {}

  async restrict(chatId: bigint, userId: number, untilDate?: number) {
    return this.api.restrictChatMember(
      Number(chatId),
      userId,
      {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      },
      { until_date: untilDate },
    );
  }

  async unrestrict(chatId: bigint, userId: number) {
    return this.api.restrictChatMember(Number(chatId), userId, {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_change_info: false,
      can_invite_users: false,
      can_pin_messages: false,
    });
  }

  async ban(chatId: bigint, userId: number) {
    return this.api.banChatMember(Number(chatId), userId);
  }

  async unban(chatId: bigint, userId: number) {
    return this.api.unbanChatMember(Number(chatId), userId);
  }

  async deleteMessage(chatId: bigint, messageId: number) {
    return this.api.deleteMessage(Number(chatId), messageId);
  }
}