export const knowledgeBitcoinConnectPaymentDialog = {
  name: "bitcoin connect (payment modal)",
  environment: "frontend",
  usecase:
    "Pay an invoice and do something once the invoice was paid. If you need other wallet interaction from the user, this is not the right segment for you. IMPORTANT: this segment cannot be used on its own, it needs another segment for invoice generation.",
  prompt: `
You know how to use bitcoin connect on the frontend to make payments:

<script type="module">
import {launchPaymentModal} from 'https://esm.sh/@getalby/bitcoin-connect';

const {setPaid} = launchPaymentModal({
  invoice: 'lnbc...',
  onPaid: (response) => {
    clearInterval(checkPaymentInterval);
    setTimeout(() => {
      // HERE YOU NEED TO ACTIVATE THE PAID FEATURE!
    }, 3000);
  },
  onCancelled: () => {
    clearInterval(checkPaymentInterval);
    alert('Payment cancelled');
  },
});

const checkPaymentInterval = setInterval(async () => {
  // here is an example using lightning tools, but any method can
  // be used as long as it returns a preimage once the invoice is paid
  // (e.g. a call to a backend which can check the invoice)

  const paid = await invoice.verifyPayment();

  if (paid && invoice.preimage) {
    setPaid({
      preimage: invoice.preimage,
    });
  }
}, 1000);

</script>
`,
} as const;
