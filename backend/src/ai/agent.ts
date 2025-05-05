import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, LanguageModelV1, streamText } from "ai";
import {
  buildSystemPrompt,
  optionalSystemPromptSegmentRecipes,
  optionalSystemPromptSegments,
} from "./systemPrompt";

const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
let chatModel: LanguageModelV1;

if (geminiApiKey) {
  const modelName = "gemini-2.5-pro-exp-03-25";
  const google = createGoogleGenerativeAI({
    apiKey: geminiApiKey,
  });
  chatModel = google(modelName);
} else {
  if (!openRouterApiKey) {
    throw new Error("No API key provided");
  }
  const modelName = "deepseek/deepseek-chat-v3-0324:free";
  //const modelName = "deepseek/deepseek-chat:free";
  const openrouter = createOpenRouter({
    apiKey: openRouterApiKey,
  });
  chatModel = openrouter.chat(modelName);
}

export const generateSystemPrompt = async (prompt: string, seed: number) => {
  const segmentPrompts: string[] = [];
  let segmentNames: string[] = [];
  try {
    const { text } = await generateText({
      model: chatModel,
      system: `You are an expert software architect. Your task is to review the given prompt and figure out if a backend is needed or not, and which additional knowledge we need. Here are the segments: ${JSON.stringify(
        optionalSystemPromptSegments.map((segment) => ({
          name: segment.name,
          usecase: segment.usecase,
          environment: segment.environment,
        }))
      )}. Pay special care to the usecase and environment ("frontend" = it can only be used in the html app, "backend" = it can only be used in the deno code, "any" = can be used in both.)

      Here are some recipes:
      ${JSON.stringify(optionalSystemPromptSegmentRecipes)}
      
      MANDATORY INSTRUCTIONS:
      Return the EXACT names (exact characters and casing) of the segments from the provided JSON that you think should be used as a JSON string array, without any explanations or surrounding text.`,
      prompt,
      seed,
    });
    console.log("Got segment names:", text);

    let arrayStart = text.indexOf("[");
    let arrayEnd = text.lastIndexOf("]");
    const extractedText = text.slice(arrayStart, arrayEnd + 1);

    segmentNames = JSON.parse(extractedText) as string[];
    if (!Array.isArray(segmentNames)) {
      throw new Error("segment names is not an array");
    }

    for (const name of segmentNames) {
      const segment = optionalSystemPromptSegments.find(
        (segment) => segment.name === name
      );
      if (!segment) {
        throw new Error("Unknown segment: " + name);
      }
      segmentPrompts.push(segment.prompt);
    }

    if (!segmentPrompts.length) {
      throw new Error("No segments found!");
    }
  } catch (error) {
    console.error("Error generating finding parts for system prompt:", error);
    // Return a generic title or re-throw, depending on desired handling
    throw error;
  }

  const systemPrompt = buildSystemPrompt(segmentPrompts);

  return { systemPrompt, segmentNames };
};

// Updated function signature to return AsyncIterable<string>
export const executePrompt = (
  prompt: string,
  systemPrompt: string,
  seed: number
): AsyncIterable<string> => {
  console.log("Streaming from OpenRouter for prompt:", prompt);

  console.log("System prompt: ", systemPrompt);

  // Return the stream directly without awaiting or iterating here
  // Note: We need to wrap the streamText call in an async generator
  // because streamText itself is async and we can't return its result directly
  // from a synchronous function.
  async function* generateStream(): AsyncIterable<string> {
    const { textStream } = await streamText({
      model: chatModel,
      system: systemPrompt,
      seed,
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
export const generateAppTitle = async (
  html: string,
  seed: number
): Promise<string> => {
  try {
    const { text } = await generateText({
      model: chatModel,
      system: `You are an expert copywriter. Your task is to generate a concise and catchy title for a web application based on the given HTML. If you find a title in the app, use that. Otherwise, generate one. Only output the title itself, without any explanations or surrounding text.`,
      prompt: `Generate a title for an app described as follows: "${html}"`,
      seed,
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
export const evaluatePrompt = async (
  prompt: string,
  systemPrompt: string,
  seed: number
): Promise<string> => {
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
      4. Identify the main areas where the user's prompt could be improved for better results. List these as bullet points, ordered by importance (most critical improvement first). Focus on aspects that might lead to misinterpretation or incomplete generation by the web development AI.
      5. Format your output EXACTLY as follows:
         Score: [Your Score]/10

         Suggestions:
         - [Suggestion 1]
         - [Suggestion 2]
         - ...

      Only output the score and suggestions in this format. Do not include any other explanations or introductory text.`,
      prompt: `Evaluate the following prompt context:\n\n${fullPromptContext}`,
      seed,
    });
    console.log("Generated prompt evaluation:", text);
    return text.trim();
  } catch (error) {
    console.error("Error evaluating prompt:", error);
    return "Score: N/A\nSuggestions:\n- Error evaluating prompt.";
  }
};
