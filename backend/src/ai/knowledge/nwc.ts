export const knowledgeNWC = {
  name: "NWC",
  environment: "any",
  usecase:
    "Connect to and interact with a wallet using NWC (e.g. make or pay invoices)",
  prompt: `
You know how to use Nostr Wallet Connect (NWC/NIP-47) to interact with a wallet.
Please note NWC uses millisats unit (1 sat/satoshi = 1000 millisats). Here is how to use NWC:

import {nwc} from "https://esm.sh/@getalby/sdk"

const nwcClient = new nwc.NWCClient({
nostrWalletConnectUrl: "nostr+walletconnect://...", // set the NWC URL here
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

// list transactions

const {transactions} = await client.listTransactions({
  limit: 10,
  offset: 0, // can increase this for pagination
});

// transactions is an array of:
/* {
  "type": "incoming", // "incoming" for invoices, "outgoing" for payments
  "invoice": "string", // encoded invoice, optional
  "description": "string", // invoice's description, optional
  "description_hash": "string", // invoice's description hash, optional
  "preimage": "string", // payment's preimage, optional if unpaid
  "payment_hash": "string", // Payment hash for the payment
  "amount": 123, // value in msats
  "fees_paid": 123, // value in msats
  "created_at": unixtimestamp, // invoice/payment creation time
  "expires_at": unixtimestamp, // invoice expiration time, optional if not applicable
  "settled_at": unixtimestamp, // invoice/payment settlement time, optional if unpaid
  "metadata": {} // generic metadata that can be used to add things like zap/boostagram details for a payer name/comment/etc.
}*/

`,
} as const;
