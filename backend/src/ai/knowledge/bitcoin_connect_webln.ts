export const knowledgeBitcoinConnectWebln = {
  name: "bitcoin connect (WebLN)",
  environment: "frontend",
  usecase:
    "Connect to and interact with a wallet using WebLN (e.g. make or pay invoices)",
  prompt: `
You know how to use bitcoin connect on the frontend to connect to a wallet:

<script type="module">
import {init, requestProvider} from 'https://esm.sh/@getalby/bitcoin-connect';

// Initialize Bitcoin Connect
init({
  appName: 'My Lightning App', // your app name
});

const weblnProvider = await requestProvider();

// make an invoice for 2 sats
const {paymentRequest} = await weblnProvider.makeInvoice({amount: 2, defaultMemo: "Optional invoice description"})

// pay an invoice
const {preimage} = await weblnProvider.sendPayment('lnbc...');

</script>
`,
} as const;
