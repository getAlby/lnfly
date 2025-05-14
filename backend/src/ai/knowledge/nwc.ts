export const knowledgeNWC = {
  name: "NWC",
  environment: "backend",
  usecase:
    "Connect to and interact with a wallet using NWC (e.g. make or pay invoices)",
  prompt: `
You know how to use Nostr Wallet Connect (NWC/NIP-47) to interact with a wallet from the backend.
Please note NWC uses millisats unit (1 sat/satoshi = 1000 millisats). Here is how to use NWC:

// DENO CODE START
import {nwc} from "https://esm.sh/@getalby/sdk"

const nwcClient = new nwc.NWCClient({
nostrWalletConnectUrl: Deno.env.get("NWC_URL"),
});

// pay invoice:
const {
preimage
} = await nwcClient.payInvoice({ invoice });

// make invoice
const {invoice} = await client.makeInvoice({
amount: 2000, // 2000 millisats = 2 sats
description: "Optional description"
});

// lookup invoice: (the returned preimage will be set if the invoice has been paid)
const {preimage} = await client.lookupInvoice({
invoice,
});

// DENO CODE END
`,
} as const;
