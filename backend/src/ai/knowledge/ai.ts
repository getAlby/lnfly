export const knowledgeAI = {
  name: "AI",
  environment: "backend",
  usecase: "Prompt an AI from the backend of the app",
  prompt: `**Deno AI Capabilities**
- If the app needs to prompt an AI, it can use PPQ.ai which is an openAI-compatible API.
- set messageContent as needed.
- optionally provide a system prompt to provide specific instructions or context that you want the assistant to follow.
- if the response is an empty string, consider the request failed.

- **Deno Code Structure:** Follow this structure for generating the necessary deno code.

  async function promptAI(messageContent: string, systemPrompt?: string) {
    const url = "https://api.ppq.ai/chat/completions";

    const headers = new Headers({
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${Deno.env.get("PPQ_API_KEY")}\`
    });

    const data = {
      model: "claude-sonnet-4",
      messages: [
        { role: "system", content: systemPrompt || "You are a helpful assistant." },
        { role: "user", content: messageContent }
      ]
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(\`HTTP error. Status: \${response.status}\`);
      }

      const responseData = await response.json();
      return messageContent = responseData.choices[0].message.content;
    } catch (error) {
      console.error('PPQ Error:', error);
      return "";
    }
  }
`,
} as const;
