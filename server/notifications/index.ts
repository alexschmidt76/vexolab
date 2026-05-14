import { Expo, ExpoPushMessage } from "expo-server-sdk"
import axios from "axios"
import { db } from "../db/index"

const expo = new Expo()

export async function sendNotification(userId: string, title: string, body: string): Promise<void> {
  const { data: user } = await db
    .from("users")
    .select("expo_push_token, slack_webhook_url, discord_webhook_url")
    .eq("id", userId)
    .single()

  if (!user) return

  await Promise.allSettled([
    user.expo_push_token ? sendPush(user.expo_push_token, title, body) : null,
    user.slack_webhook_url ? sendSlack(user.slack_webhook_url, title, body) : null,
    user.discord_webhook_url ? sendDiscord(user.discord_webhook_url, title, body) : null,
  ])
}

async function sendPush(token: string, title: string, body: string) {
  if (!Expo.isExpoPushToken(token)) return
  const message: ExpoPushMessage = { to: token, title, body, sound: "default" }
  await expo.sendPushNotificationsAsync([message])
}

async function sendSlack(webhookUrl: string, title: string, body: string) {
  await axios.post(webhookUrl, {
    blocks: [{ type: "section", text: { type: "mrkdwn", text: `*${title}*\n${body}` } }],
  })
}

async function sendDiscord(webhookUrl: string, title: string, body: string) {
  await axios.post(webhookUrl, {
    embeds: [{ title, description: body, color: 0x6366f1 }],
  })
}

// keep old name as alias so existing callers still work
export const notifyUser = sendNotification
