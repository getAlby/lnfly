export const knowledgeLightningToolsParseInvoice = {
  name: "lightning tools - parse invoice",
  environment: "any",
  usecase:
    "parse a lightning invoice e.g. to check the amount of satoshis or read the description",
  prompt: `
You know how to use lightning tools to parse a BOLT11 lightning invoice:

<script type="module">
import { Invoice } from "https://esm.sh/@getalby/lightning-tools@5.0.0";

const {satoshi, description} = new Invoice({ pr: "lnbc..."});

</script>`,
} as const;
