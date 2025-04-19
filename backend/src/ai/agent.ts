import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import fs from "fs";
import path from "path";

const apiKey = process.env.OPENROUTER_API_KEY;
const modelName = "deepseek/deepseek-chat-v3-0324:free";

// Helper async generator for the mock case
async function* mockStream(): AsyncIterable<string> {
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulate delay
  const mockOutputPath = path.join(__dirname, "mock-output.html");
  try {
    const fileContent = fs.readFileSync(mockOutputPath, "utf-8");
    yield fileContent; // Yield the content as a single chunk
  } catch (error) {
    console.error("Error reading mock output file:", error);
    yield `<p>Error loading content.</p>`; // Yield an error message
  }
}

// Updated function signature to return AsyncIterable<string>
export const executePrompt = (prompt: string): AsyncIterable<string> => {
  // Handle the mock case by returning the async generator
  if (prompt === "MOCK_OUTPUT") {
    // Simplified check
    console.log("Using mock stream for 'snake' prompt.");
    return mockStream();
  }

  // Normal case: return the textStream directly
  const openrouter = createOpenRouter({
    apiKey,
  });
  const chatModel = openrouter.chat(modelName);
  console.log("Streaming from OpenRouter for prompt:", prompt);

  // Return the stream directly without awaiting or iterating here
  // Note: We need to wrap the streamText call in an async generator
  // because streamText itself is async and we can't return its result directly
  // from a synchronous function.
  async function* generateStream(): AsyncIterable<string> {
    const { textStream } = await streamText({
      model: chatModel,
      system: `You are an expert web developer AI. Your task is to generate a complete, single-file HTML application based on a user's prompt.

You know how to use bitcoin connect and lightning tools to accept payments:

<script type="module">
  import {launchPaymentModal} from 'https://esm.sh/@getalby/bitcoin-connect@3.7.0';
  import { LightningAddress } from "https://esm.sh/@getalby/lightning-tools@5.0.0";

  // here use the lightning address provided by the user
  const ln = new LightningAddress("rolznzfra@getalby.com");

  await ln.fetch();
  const invoice = await ln.requestInvoice({ satoshi: 21 });

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
    const paid = await invoice.verifyPayment();

    if (paid && invoice.preimage) {
      setPaid({
        preimage: invoice.preimage,
      });
    }
  }, 1000);

</script>

Here are the rules you MUST follow.
- The output MUST be a single HTML file.
- All necessary HTML structure, CSS styles (inside <style> tags), and JavaScript logic (inside <script> tags) must be included within this single file.
- Do NOT use external CSS or JavaScript files unless they are from a CDN.
- Do NOT link to external images unless specifically requested in the prompt.
- Ensure the generated code is valid, functional, and directly runnable in a browser.
- Only output the HTML code itself, without any explanations or surrounding text.
- No md file syntax (e.g. html\`\`\`...\`\`\` ).
`,
      prompt,
    });
    // Yield each part of the stream as it comes in
    yield* textStream;
    console.log("Finished streaming from OpenRouter.");
  }

  return generateStream();
};
