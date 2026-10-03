import type { PaymentMethod } from "@/types/cart";

// No provider is configured. This delay is only a clearly labelled demo interaction.
export async function processDemoPayment(method: PaymentMethod): Promise<void> {
  if (method === "pickup") return;
  await new Promise(resolve => setTimeout(resolve, 900));
}
