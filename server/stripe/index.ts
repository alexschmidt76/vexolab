import Stripe from "stripe"
import config from "../config/index"
import { db } from "../db/index"

let _stripe: Stripe | null = null
function getStripe() {
  if (!_stripe) _stripe = new Stripe(config.stripeSecretKey)
  return _stripe
}

// create a stripe checkout session for the given tier and return the hosted payment url
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  tier: "starter" | "pro" | "pro_api"
): Promise<string> {
  const priceId =
    tier === "starter"
      ? config.stripeStarterPriceId
      : tier === "pro"
      ? config.stripeProPriceId
      : config.stripeProApiPriceId

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${config.serverUrl}/billing/success`,
    cancel_url: `${config.serverUrl}/billing/cancel`,
    metadata: { userId, tier },
    customer_email: userEmail,
  })
  return session.url!
}

// handle incoming stripe webhook events
export async function handleWebhook(
  payload: Buffer,
  signature: string
): Promise<void> {
  const event = getStripe().webhooks.constructEvent(
    payload,
    signature,
    config.stripeWebhookSecret
  )

  // upgrade the user to the purchased tier when checkout is completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const userId = (session as any).metadata?.userId
    const tier = (session as any).metadata?.tier || "pro"

    if (userId) {
      await db
        .from("users")
        .update({ tier, stripe_customer_id: (session as any).customer })
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
