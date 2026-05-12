import Stripe from "stripe"
import config from "../config/index"
import { db } from "../db/index"

const stripe = new Stripe(config.stripeSecretKey)

// create a stripe checkout session and return the hosted payment url
export async function createCheckoutSession(
  userId: string,
  userEmail: string
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: config.stripeProPriceId, quantity: 1 }],
    success_url: `${config.serverUrl}/billing/success`,
    cancel_url: `${config.serverUrl}/billing/cancel`,
    metadata: { userId },
    customer_email: userEmail,
  })
  return session.url!
}

// handle incoming stripe webhook events
export async function handleWebhook(
  payload: Buffer,
  signature: string
): Promise<void> {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripeWebhookSecret
  )

  // upgrade the user to pro when checkout is completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const userId = (session as any).metadata?.userId

    if (userId) {
      await db
        .from("users")
        .update({
          tier: "pro",
          stripe_customer_id: (session as any).customer,
        })
        .eq("id", userId)
    }
  }

  // downgrade the user to free when their subscription is cancelled
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object
    await db
      .from("users")
      .update({ tier: "free" })
      .eq("stripe_customer_id", (subscription as any).customer)
  }
}
