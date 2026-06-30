import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { startAutonomousAgent } from "./src/ai-agent";
import { KEYS } from "./src/config";
import http from "http";
import { Server as SocketServer } from "socket.io";
import { spawn } from "child_process";

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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || KEYS.AG);

// Helper to perform OpenRouter requests with dynamic token and model fallback
async function callOpenRouterWithFallback(params: {
  messages: any[];
  response_format?: any;
  max_tokens?: number;
  temperature?: number;
}) {
  // Ordered list of models to try. We start with Google Gemini 2.5 Flash as standard,
  // then fallback to Gemini 2.5 Flash Free (does not require paid credits),
  // then Llama 3.1 8B Free, then Qwen 2.5 72B Instruct Free.
  const modelsToTry = [
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "qwen/qwen-2-72b-instruct:free",
    "meta-llama/llama-3-8b-instruct"
  ];

  let lastError: any = null;
  let maxTokens = params.max_tokens || 2000;

  for (const model of modelsToTry) {
    try {
      console.log(`[AI fallback] Trying OpenRouter with model: ${model}, max_tokens: ${maxTokens}`);
      const options: any = {
        model: model,
        messages: params.messages,
        max_tokens: maxTokens,
      };
      if (params.response_format) {
        options.response_format = params.response_format;
      }
      if (params.temperature !== undefined) {
        options.temperature = params.temperature;
      }

      const response = await openrouter.chat.completions.create(options);
      const content = response.choices[0]?.message?.content;
      if (content !== undefined && content !== null) {
        console.log(`[AI fallback] Success with model: ${model}!`);
        return content;
      }
    } catch (err: any) {
      console.warn(`[AI fallback] Model ${model} failed:`, err.message || err);
      lastError = err;

      // Check for specific payment/credit or token-budget errors from OpenRouter
      const errStr = String(err.message || err);
      
      if (errStr.includes("credits") || errStr.includes("afford") || errStr.includes("402")) {
        // e.g., "You requested up to 65535 tokens, but can only afford 2425."
        const match = errStr.match(/can only afford (\d+)/i);
        if (match) {
          const affordable = parseInt(match[1], 10);
          console.log(`[AI fallback] OpenRouter says we can only afford ${affordable} tokens. Adjusting limit.`);
          maxTokens = Math.max(128, Math.min(maxTokens, Math.floor(affordable * 0.8)));
        } else {
          maxTokens = Math.max(128, Math.floor(maxTokens * 0.5));
        }
      }
    }
  }

  throw lastError || new Error("All OpenRouter models failed");
}

// Global resilient helper to get an AI response from OpenRouter with Puter & Gemini fallbacks
async function generateAIResponse(params: {
  messages: any[];
  response_format?: any;
  max_tokens?: number;
  temperature?: number;
}) {
  // 1. Try OpenRouter first with automatic model and token scaling
  try {
    return await callOpenRouterWithFallback(params);
  } catch (err: any) {
    console.warn("[AI unified] All OpenRouter models failed, trying Puter AI as fallback...", err.message || err);
  }

  // 2. Try Puter AI as second fallback
  try {
    const systemMsg = params.messages.find(m => m.role === "system")?.content || "";
    const userMsgs = params.messages.filter(m => m.role === "user").map(m => m.content).join("\n\n");
    const puterResponse = await fetch("https://api.puter.com/v1/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PUTER_API_KEY || "public"}`
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemMsg || "You are an expert AI programming assistant." },
          { role: "user", content: userMsgs }
        ],
        model: "gpt-4o-mini",
        stream: false
      })
    });

    if (puterResponse.ok) {
      const puterData = await puterResponse.json();
      const content = puterData.choices[0]?.message?.content || "";
      if (content) {
        console.log("[AI unified] Success with Puter AI!");
        return content;
      }
    }
  } catch (e: any) {
    console.warn("[AI unified] Puter AI fallback failed:", e.message || e);
  }

  // 3. Try direct Gemini (GoogleGenerativeAI) as final fallback
  try {
    const userMsgs = params.messages.filter(m => m.role === "user").map(m => m.content).join("\n\n");
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: params.response_format ? { responseMimeType: "application/json" } : undefined
    });
    const result = await model.generateContent(userMsgs);
    const content = result.response.text();
    if (content) {
      console.log("[AI unified] Success with direct Gemini!");
      return content;
    }
  } catch (e: any) {
    console.error("[AI unified] Direct Gemini fallback failed:", e.message || e);
  }

  throw new Error("All AI Providers (OpenRouter, Puter, and Gemini) failed. Please check your credentials or token budget.");
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketServer(server, { cors: { origin: "*" } });
  const PORT = 3000;

  // Socket.io for Real Terminal
  io.on("connection", (socket) => {
    let ptyProcess: any = null;

    socket.on("terminal:start", () => {
      if (ptyProcess) return;
      ptyProcess = spawn("bash", [], {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env
      } as any);

      ptyProcess.stdout.on("data", (data: any) => {
        socket.emit("terminal:data", data.toString());
      });

      ptyProcess.stderr.on("data", (data: any) => {
        socket.emit("terminal:data", data.toString());
      });

      ptyProcess.on("exit", () => {
        socket.emit("terminal:data", "\r\n*** Process exited ***\r\n");
      });
    });

    socket.on("terminal:resize", ({ cols, rows }) => {
      if (ptyProcess && ptyProcess.resize) {
        // Note: native spawn doesn't have .resize, but if we used node-pty it would.
        // For standard spawn we can't easily resize but we can try to set env
      }
    });

    socket.on("terminal:data", (data) => {
      if (ptyProcess) {
        ptyProcess.stdin.write(data);
      }
    });

    socket.on("disconnect", () => {
      if (ptyProcess) {
        ptyProcess.kill();
      }
    });
  });

  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));

  // AI Chat Route
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      const content = await generateAIResponse({
        messages: messages,
        max_tokens: 2000,
      });
      res.json({ reply: content });
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    try {
      const { code, language, error } = req.body;

      let prompt = `You are an expert AI programming assistant. Analyze the following ${language} code. `;
      if (error) {
        prompt += `The user requested the following or it produced this error:\n${error}\n\n`;
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

      const responseText = await generateAIResponse({
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

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

  app.post("/api/apk-edit", async (req, res) => {
    try {
      const { prompt, systemPrompt, files } = req.body;

      let aiPrompt = `${systemPrompt || "You are CoKe 1.0, an elite Android APK Modding and Analysis AI. You have absolute mastery over smali, AndroidManifest.xml, and resource files."}\n\n`;
      aiPrompt += `USER REQUEST: "${prompt}"\n\n`;
      aiPrompt += `CONTEXT FILES:\n`;
      
      files.forEach((f: any) => {
        aiPrompt += `### FILE: ${f.path}\n${f.content}\n\n`;
      });
      
      aiPrompt += `INSTRUCTIONS:
1. Analyze the request and the provided files.
2. Determine which files need modification to satisfy the request.
3. Return a JSON object with an "edits" array.
4. Each edit must contain "path" and "content" (full file content).
5. BE PRECISE. If you are translating, translate ONLY the requested parts while keeping XML structure intact.

JSON SCHEMA:
{
  "edits": [
    { "path": "path/to/file", "content": "..." }
  ]
}`;

      const responseText = await generateAIResponse({
        messages: [
          { role: "system", content: systemPrompt || "You are CoKe 1.0, an elite Android APK Modding and Analysis AI." },
          { role: "user", content: aiPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000
      });

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        // Fallback for non-JSON responses
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error("Invalid AI Response Format");
        }
      }

      res.json(parsed);
    } catch (err: any) {
      console.error("APK AI Edit Error:", err);
      res.status(500).json({ error: err.message || "Failed to edit APK with AI" });
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
            model: "llama-3.1-8b-instant",
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

  // In-memory store for Arena scripts
  let arenaScripts: any[] = [];

  app.get("/api/arena", (req, res) => {
    res.json(arenaScripts);
  });

  app.post("/api/arena", (req, res) => {
    const newScript = {
      ...req.body,
      id: Math.random().toString(36).substring(2, 9),
      likes: 0,
      createdAt: Date.now()
    };
    arenaScripts.push(newScript);
    res.json(newScript);
  });

  app.post("/api/arena/:id/like", (req, res) => {
    const script = arenaScripts.find(s => s.id === req.params.id);
    if (script) {
      script.likes += 1;
      res.json(script);
    } else {
      res.status(404).json({ error: "Not found" });
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Запускаем фонового ИИ-агента
    startAutonomousAgent();
  });
}

startServer();
