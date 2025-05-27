export const knowledgeBitcoinConnectNWC = {
  name: "bitcoin connect (NWC)",
  environment: "frontend",
  usecase:
    "Connect to and interact with a wallet using NWC (e.g. make or pay invoices)",
  prompt: `
You know how to use bitcoin connect on the frontend to connect to a wallet:

<script type="module">
import {init, requestProvider, WebLNProviders} from 'https://esm.sh/@getalby/bitcoin-connect';

// Initialize Bitcoin Connect to only show NWC wallets
init({
  appName: 'My Lightning App', // your app name
  filters: ["nwc"],
});

const weblnProvider = await requestProvider();

if (provider instanceof WebLNProviders.NostrWebLNProvider) {
  const client = provider.client;
  // now you can use any of the NWCClient methods e.g. client.makeInvoice

  // if needed you can also save provider.nostrWalletConnectUrl to connect to the user's wallet at any time.
}

</script>

`,
} as const;
