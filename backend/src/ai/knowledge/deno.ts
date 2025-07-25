export const knowledgeDeno = {
  name: "Deno backend",
  environment: "backend",
  usecase:
    "Implement a backend for the app - e.g. for persisting data, or paying users, or multiplayer experiences",
  prompt: `**Deno Backend Generation:**
- If a backend is required, generate a single Deno TypeScript file.
- The Deno code MUST be runnable using \`deno run --allow-net --allow-env=PORT,NWC_URL,LIGHTNING_ADDRESS,STORAGE_PATH,NSEC,PPQ_API_KEY <filename>\`.
- The Deno server MUST listen on the port specified by the \`PORT\` environment variable. Example: \`const port = parseInt(Deno.env.get("PORT") || "8000");\`
- Use the standard Deno HTTP server (\`Deno.serve\`).
- If payments are required, use the NWC code mentioned above.
- The HTTP server must only have api endpoints. It should not serve static HTML.
- Keep the backend simple and focused on the prompt's requirements.

- **Persistent Storage:** Your backend has access to a persistent sqlite file for storing data between restarts.
  - The path to this file is provided in the \`STORAGE_PATH\` environment variable.
  - Read and write permissions (\`--allow-read\`, \`--allow-write\`) for this specific file path are automatically granted.
  - Use \`Deno.env.get("STORAGE_PATH")\` to get the path.
  - Use \`import { DatabaseSync, /* + other necessary imports */ } from 'node:sqlite';\` and \`const database = new DatabaseSync(path);\`

- **Payments Support**
  - The app developer can specify a lightning address to receive payments made by the user.
  - The app developer can specify a NWC URL to connect to their wallet from the backend.
  - The NWC_URL environment variable can be used to configure the backend's NWC wallet
  - The LIGHTNING_ADDRESS environment variable can be used to fetch invoices from the backend's lightning address

- **Nostr Support**
  - The app developer can specify a nostr private key (nsec) to sign notes.
  - The NSEC environment variable will be set to the app developer's nsec.

- **AI Support:** Your backend has access to an endpoint to do AI prompts.
  - The app developer can specify an openAI-compatible API key to prompt an AI.
  - The PPQ_API_KEY environment variable will be set to the app developer's openAI-compatible API key.
  
- **Deno App Structure:** Make sure to follow this exact structure for generating deno code.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// add other necessary imports here

const port = parseInt(Deno.env.get("PORT") || "8000");

serve((req: Request) => {
  // Backend logic here
  return new Response("Hello from Deno!");
}, { port });

// Make sure to log this EXACT message, as it's used to detect startup.
console.log(\`Deno server running on port \${port}\`);
`,
} as const;
