export const knowledgeLightningToolsRequestInvoice = {
  name: "lightning tools - request invoice from lightning address",
  environment: "any",
  usecase: "fetch a lightning invoice from a lightning address.",
  prompt: `
You know how to use lightning tools to generate a lightning invoice for a lightning address and check if it was paid:

<script type="module">
import { LightningAddress, Invoice } from "https://esm.sh/@getalby/lightning-tools";

const ln = new LightningAddress("example@getalby.com");

await ln.fetch();
const invoice = await ln.requestInvoice({ satoshi: 21, comment: "Optional comment" });

/* returns {
  paymentRequest: string,
  paymentHash: string,
  preimage: string | null,
  verify: string | null,
  satoshi: number,
  expiry: number,
  timestamp: number,
  description: string | null,
  verifyPayment(): Promise<boolean>
}
*/

// the string invoice is available as \`invoice.paymentRequest\`

// to check if it was paid:
const paid = await invoice.verifyPayment(); // returns boolean

// later you can also check it was paid if you have the payment request (pr) and verify string:
const invoice = new Invoice({pr, verify});
const paid = await invoice.verifyPayment(); // returns boolean

</script>`,
} as const;
