import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export interface SlackUser {
  id: string;
  name: string;
  email: string;
}

export async function lookupUserByEmail(
  email: string
): Promise<SlackUser | null> {
  try {
    const res = await slack.users.lookupByEmail({ email });
    const u = res.user;
    if (!u || !u.id || !u.profile) return null;
    return {
      id: u.id,
      name: u.real_name || u.name || "",
      email: u.profile.email || email,
    };
  } catch {
    return null;
  }
}

export async function sendDirectMessage(
  slackUserId: string,
  text: string
): Promise<void> {
  const conv = await slack.conversations.open({ users: slackUserId });
  const channelId = conv.channel?.id;
  if (!channelId) throw new Error("Failed to open DM channel");
  await slack.chat.postMessage({ channel: channelId, text });
}
