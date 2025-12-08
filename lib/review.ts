import OpenAI from "openai";
import type { RepoFile } from "./github";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export type ReviewResult = {
  summary: string;
  techStack: string[];
  risks: string[];
  suggestions: { title: string; details: string }[];
  files: { path: string; issues: string[] }[];
};

const MAX_TOTAL_CHARS = 40000;

export async function reviewRepository(params: {
  files: RepoFile[];
  detectedTechStack: string[];
  techStackOverride?: string;
}): Promise<ReviewResult> {
  const { files, detectedTechStack, techStackOverride } = params;

  let accumulated = "";
  const includedFiles: RepoFile[] = [];

  for (const file of files) {
    const chunk = `\n--- FILE: ${file.path} ---\n${file.content}\n`;
    if (accumulated.length + chunk.length > MAX_TOTAL_CHARS) break;
    accumulated += chunk;
    includedFiles.push(file);
  }

  const techStack =
    techStackOverride && techStackOverride.trim().length > 0
      ? techStackOverride
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : detectedTechStack;

  const systemPrompt = `
    You are an expert software architect and senior code reviewer.
  
    You will receive:
    - A list of technologies used (possibly approximate)
    - A concatenated view of multiple files from a GitHub repository
  
    Your tasks:
    1. Give a high-level summary of the codebase.
    2. Highlight important risks (security, performance, maintainability).
    3. Suggest concrete improvements (architecture, patterns, testing, DX).
    4. Call out per-file issues when possible (for the files you see).
  
    Rules:
    - Be practical and concise, but specific.
    - Assume this is production or near-production code.
    - Focus on truly important feedback, not nitpicks.
    - Respond ONLY in valid JSON with this shape:
  
    {
      "summary": "string",
      "techStack": ["string"],
      "risks": ["string"],
      "suggestions": [
        { "title": "string", "details": "string" }
      ],
      "files": [
        { "path": "string", "issues": ["string"] }
      ]
    }
    `;
  
      const userPrompt = `
    Technologies (user/detected): ${techStack.join(", ") || "Unknown"}
  
    Codebase snapshot (subset of files):
  
    ${accumulated}
    `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || "No summary provided.",
      techStack: parsed.techStack || techStack || [],
      risks: parsed.risks || [],
      suggestions: parsed.suggestions || [],
      files: parsed.files || [],
    };
  } catch (err) {
    console.error("Failed to parse review JSON", err, content);
    return {
      summary: "Failed to parse structured review from AI.",
      techStack,
      risks: [],
      suggestions: [
        {
          title: "Parse error",
          details:
            "The AI response was not valid JSON. Check server logs for details.",
        },
      ],
      files: [],
    };
  }
}
