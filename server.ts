import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    try {
      const { code, language, error } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
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

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      const responseText = response.text;
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
