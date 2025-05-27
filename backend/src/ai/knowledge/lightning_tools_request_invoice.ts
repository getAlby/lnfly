export const knowledgeLightningToolsRequestInvoice = {
  name: "lightning tools - request invoice from lightning address",
  environment: "any",
  usecase: "fetch a lightning invoice from a lightning address.",
  prompt: `
You know how to use lightning tools to generate a lightning invoice for a lightning address and check if it was paid:

<script type="module">
import { LightningAddress } from "https://esm.sh/@getalby/lightning-tools";

const ln = new LightningAddress("example@getalby.com");

await ln.fetch();
const invoice = await ln.requestInvoice({ satoshi: 21, comment: "Optional comment" });

// to check if it was paid:
const paid = await invoice.verifyPayment(); // returns boolean
</script>`,
} as const;
