import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import OpenAI from "openai";
import util from "util";
import { KEYS } from "./config";

const execAsync = util.promisify(exec);

// Автономный ИИ-агент, работающий в фоне
const agentAi = new OpenAI({
  // Замените baseURL, если этот ключ от специфичного провайдера (например, OpenAI, OpenRouter, Proxy и т.д.)
  baseURL: process.env.AGENT_BASE_URL || "https://api.openai.com/v1", 
  apiKey: process.env.AGENT_API_KEY || KEYS.AG,
});

export function startAutonomousAgent() {
  console.log("🤖 Autonomous AI Agent started in background...");

  // Агент просыпается каждые 5 минут (можно изменить интервал)
  setInterval(async () => {
    try {
      console.log("🤖 [AI Agent] Waking up to check for improvements...");

      // 1. Читаем текущее состояние проекта (например, package.json)
      const pkgPath = path.join(process.cwd(), "package.json");
      const pkgRaw = await fs.readFile(pkgPath, "utf-8");

      const prompt = `You are an autonomous AI developer managing a web application.
Your goal is to improve the site, install useful plugins, or refactor code.
Current package.json:
${pkgRaw}

Decide what to do next. 
Return a JSON object with one of the following structures:
1. To install a new plugin: { "action": "install", "packages": ["package-name"] }
2. To refactor/improve a file: { "action": "refactor", "target": "src/components/EditorView.tsx", "instruction": "what to improve" }
3. If no action is needed right now: { "action": "none" }

ONLY output valid JSON without markdown wrapping.`;

      const response = await agentAi.chat.completions.create({
        model: "gpt-4o-mini", // Укажите нужную модель, доступную по вашему ключу
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return;

      const decision = JSON.parse(content);
      console.log("🤖 [AI Agent] Decision:", decision);

      if (decision.action === "install" && decision.packages?.length > 0) {
        console.log(`🤖 [AI Agent] Installing packages: ${decision.packages.join(" ")}`);
        await execAsync(`npm install ${decision.packages.join(" ")}`);
        console.log(`🤖 [AI Agent] Installation complete.`);
      } else if (decision.action === "refactor" && decision.target) {
        console.log(`🤖 [AI Agent] Refactoring ${decision.target}...`);
        const targetPath = path.join(process.cwd(), decision.target);
        
        try {
          const fileContent = await fs.readFile(targetPath, "utf-8");
          const refactorPrompt = `Refactor this code based on the following instruction: ${decision.instruction}\n\nCode:\n${fileContent}\n\nReturn ONLY the completely updated code without markdown formatting or code blocks (\`\`\`).`;
          
          const refactorRes = await agentAi.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: refactorPrompt }],
          });
          
          let newCode = refactorRes.choices[0]?.message?.content || "";
          newCode = newCode.replace(/^```[\s\S]*?\n/, "").replace(/```$/, "");
          
          await fs.writeFile(targetPath, newCode, "utf-8");
          console.log(`🤖 [AI Agent] Successfully updated ${decision.target}`);
        } catch (err: any) {
          console.error(`🤖 [AI Agent] Failed to read/write target file: ${err.message}`);
        }
      } else {
        console.log("🤖 [AI Agent] No actions taken this cycle.");
      }
    } catch (error: any) {
      console.error("🤖 [AI Agent] Encountered an error:", error.message);
    }
  }, 5 * 60 * 1000); // 300,000 мс = 5 минут
}
