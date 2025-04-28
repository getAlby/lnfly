import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, streamText } from "ai";
import fs from "fs";
import path from "path";

const apiKey = process.env.OPENROUTER_API_KEY;
const modelName = "deepseek/deepseek-chat-v3-0324:free";

const systemPrompt = `You are an expert web developer AI. Your task is to generate a complete, single-file HTML application based on a user's prompt.

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
`;

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
      system: systemPrompt,
      prompt,
      onError: (event) => {
        throw new Error(
          "got an error while generating: " +
            ((event.error as any)?.responseBody || "unknown")
        );
      },
    });
    // Yield each part of the stream as it comes in
    yield* textStream;
    console.log("Finished streaming from OpenRouter.");
  }

  return generateStream();
};

// Function to generate a short title for the app based on the prompt
export const generateAppTitle = async (prompt: string): Promise<string> => {
  const openrouter = createOpenRouter({ apiKey });
  const chatModel = openrouter.chat(modelName);

  try {
    const { text } = await generateText({
      model: chatModel,
      system: `You are an expert copywriter. Your task is to generate a concise and catchy title for a web application based on the user's prompt describing the app. The title MUST be less than 6 words long. Only output the title itself, without any explanations or surrounding text. The first word must start with a capital letter and the title must be made of real words.`,
      prompt: `Generate a title for an app described as follows: "${prompt}"`,
    });
    console.log("Generated title:", text);
    // Basic cleanup: remove potential quotes and trim whitespace
    return text.replace(/["']/g, "").trim();
  } catch (error) {
    console.error("Error generating app title:", error);
    // Return a generic title or re-throw, depending on desired handling
    return "Untitled App";
  }
};

// Function to evaluate the clarity of the prompt and provide suggestions
export const evaluatePrompt = async (prompt: string): Promise<string> => {
  const openrouter = createOpenRouter({ apiKey });
  const chatModel = openrouter.chat(modelName);

  // Combine the user prompt with the system prompt used for generation for context
  const fullPromptContext = `
System Prompt for App Generation:
---
${systemPrompt}
---

User Prompt for App Generation:
---
${prompt}
---
`;

  try {
    const { text } = await generateText({
      model: chatModel,
      system: `You are an AI assistant specialized in evaluating the clarity and effectiveness of prompts given to a web development AI. Your task is to analyze the provided prompt context (which includes both the system instructions and the user's specific request) and provide constructive feedback.

      Follow these steps:
      1. Read the entire prompt context carefully (system instructions + user prompt).
      2. Evaluate how clear and unambiguous the user's prompt is for the web development AI, considering the system instructions and constraints. DO NOT evaluate the system prompt!
      3. Assign a clarity score from 1 (very unclear, ambiguous, likely to fail) to 10 (perfectly clear, specific, unambiguous).
      4. Identify the main areas where the user's prompt could be improved for better results. List these as bullet points, ordered by importance (most critical improvement first). Focus on aspects that might lead to misinterpretation or incomplete generation by the web development AI, (such as: when and where payments should be made and what should happen after a payment is successfully made).
      5. Format your output EXACTLY as follows:
         Score: [Your Score]/10

         Suggestions:
         - [Suggestion 1]
         - [Suggestion 2]
         - ...

      Only output the score and suggestions in this format. Do not include any other explanations or introductory text.`,
      prompt: `Evaluate the following prompt context:\n\n${fullPromptContext}`,
    });
    console.log("Generated prompt evaluation:", text);
    return text.trim();
  } catch (error) {
    console.error("Error evaluating prompt:", error);
    return "Score: N/A\nSuggestions:\n- Error evaluating prompt.";
  }
};
