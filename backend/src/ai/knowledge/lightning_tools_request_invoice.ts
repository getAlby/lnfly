export const knowledgeLightningToolsRequestInvoice = {
  name: "lightning tools - request invoice from lightning address",
  environment: "frontend",
  usecase:
    "fetch a lightning invoice from a lightning address. Enabling this segment will allow the app developer to specify a lightning address to receive payments made by the user interacting with the app and can be used directly from the frontend. If you have a NWC connection to generate the invoice, use that instead",
  prompt: `
You know how to use lightning tools to generate a lightning invoice for a lightning address and check if it was paid:

<script type="module">
import { LightningAddress } from "https://esm.sh/@getalby/lightning-tools@5.0.0";

const ln = new LightningAddress("${process.env.DEFAULT_LIGHTNING_ADDRESS}");

await ln.fetch();
const invoice = await ln.requestInvoice({ satoshi: 21, comment: "Optional comment" });

// to check if it was paid:
const paid = await invoice.verifyPayment(); // returns boolean
</script>`,
} as const;
