import { Expo, ExpoPushMessage } from "expo-server-sdk"
import { db } from "../db/index"

const expo = new Expo()

// send a push notification to a user if they have a registered push token
export async function notifyUser(userId: string, title: string, body: string): Promise<void> {
  const { data } = await db.from("users").select("expo_push_token").eq("id", userId).single()
  const pushToken = data?.expo_push_token

  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return

  const message: ExpoPushMessage = { to: pushToken, title, body }
  await expo.sendPushNotificationsAsync([message])
}
