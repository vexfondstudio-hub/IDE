import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";
import { startAutonomousAgent } from "./src/ai-agent";
import { KEYS } from "./src/config";

dotenv.config();

// Initialize OpenAI clients with the provided keys (fallback to environment variables)
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || KEYS.OR,
});

const groq = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || KEYS.GQ,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    try {
      const { code, language, error } = req.body;

      let prompt = `You are an expert AI programming assistant. Analyze the following ${language} code. `;
      if (error) {
        prompt += `It produced the following error:\n${error}\n\n`;
      } else {
        prompt += `Identify any potential bugs, inefficiencies, or logic errors.\n\n`;
      }
      prompt += `Code:\n${code}\n\n`;
      prompt += `Provide a concise explanation of the problem, and a suggested code fix. Return your response as a JSON object with the following schema:
{
  "title": "A short, 2-5 word title of the issue (e.g., 'Potential NameError', 'Syntax Error', 'Optimization')",
  "description": "A 1-2 sentence explanation of the issue.",
  "suggestion": "The COMPLETE corrected code (all original code plus fixes, ready to completely replace the user's code)."
}`;

      // Use OpenRouter for analysis
      const response = await openrouter.chat.completions.create({
        model: "meta-llama/llama-3-8b-instruct", // or any other suitable OpenRouter model
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("No response from AI");
      }
      const data = JSON.parse(responseText);
      res.json(data);
    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      res.status(500).json({ error: "Failed to analyze code" });
    }
  });

  // AI Autocomplete Route
  app.post("/api/complete", async (req, res) => {
    try {
      const { codeBefore, language, word } = req.body;

      const prompt = `You are a code completion engine for ${language}.
Code before cursor:
\`\`\`
${codeBefore}
\`\`\`
Current word being typed: "${word}"

Provide 3-5 short code completion suggestions (like method names, keywords, variables, short expressions) that fit this context.
Return ONLY valid JSON in this exact format:
{
  "suggestions": ["completion1", "completion2"]
}`;

      let responseText = null;
      let retries = 3;
      while (retries > 0) {
        try {
          // Use Groq for autocomplete (faster)
          const response = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          });
          responseText = response.choices[0]?.message?.content;
          break; // Success
        } catch (error: any) {
          retries--;
          const is503 =
            error?.status === 503 ||
            error?.message?.includes("503") ||
            error?.message?.includes("UNAVAILABLE");
          if (retries === 0 || !is503) {
            throw error;
          }
          // Wait 1.5 seconds before retrying on 503
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      if (!responseText) {
        throw new Error("No response from AI");
      }
      const data = JSON.parse(responseText);
      res.json(data);
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("quota");
      if (is429) {
        // Silently fail on rate limit to prevent spamming errors to the user
        return res.json({ suggestions: [] });
      }
      console.error("AI Complete Error:", err.message || err);
      res.status(500).json({ error: "Failed to get completion" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Запускаем фонового ИИ-агента
    startAutonomousAgent();
  });
}

startServer();
