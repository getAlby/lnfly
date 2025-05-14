export const knowledgeDeno = {
  name: "Deno backend",
  environment: "backend",
  usecase:
    "Implement a backend for the app - e.g. for persisting data, or paying users, or multiplayer experiences",
  prompt: `**Deno Backend Generation:**
- If a backend is required, generate a single Deno TypeScript file.
- The Deno code MUST be runnable using \`deno run --allow-net --allow-env=PORT --allow-env=NWC_URL <filename>\`.
- The NWC URL is only be set if you have knowledge of NWC (if so it will have already been provided further up in this prompt)
- The Deno server MUST listen on the port specified by the \`PORT\` environment variable. Example: \`const port = parseInt(Deno.env.get("PORT") || "8000");\`
- Use the standard Deno HTTP server (\`Deno.serve\`).
- If payments are required, use the NWC code mentioned above.
- The HTTP server must only have api endpoints. It should not serve static HTML.
- Keep the backend simple and focused on the prompt's requirements.

- **Persistent Storage:** Your backend has access to a persistent JSON file for storing data between restarts.
  - The path to this file is provided in the \`STORAGE_PATH\` environment variable.
  - Read and write permissions (\`--allow-read\`, \`--allow-write\`) for this specific file path are automatically granted.
  - Use \`Deno.env.get("STORAGE_PATH")\` to get the path.
  - Use \`Deno.readTextFile\` and \`JSON.parse\` to read the data.
  - Use \`JSON.stringify\` and \`Deno.writeTextFile\` to save the data.
  
- **Deno App Structure:** Make sure to follow this exact structure for generating deno code.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// add other necessary imports here

const port = parseInt(Deno.env.get("PORT") || "8000");

serve((req: Request) => {
  // Backend logic here
  return new Response("Hello from Deno!");
}, { port });

console.log(\`Deno server running on port \${port}\`);
`,
} as const;
