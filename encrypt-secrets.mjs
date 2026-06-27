/**
 * Шифрование секретов для Joker IDE (AES-256-GCM).
 * Запуск: npm run secrets:encrypt
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const VAULT_SALT = "joker-ide-vault-v1";
const PASSPHRASE = "JkR-v4ult-9xK2mP7nQ4wL8sT1fH6cB3dG0aE5";

function revealKey(obfuscated) {
  return Buffer.from(obfuscated, "base64")
    .toString("utf8")
    .split("")
    .reverse()
    .join("");
}

function getMasterKey() {
  return crypto.scryptSync(PASSPHRASE, VAULT_SALT, 32);
}

function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function parseEnvFile(content) {
  const result = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadSecrets() {
  const envPath = path.join(ROOT, ".env");
  const fromEnv = fs.existsSync(envPath)
    ? parseEnvFile(fs.readFileSync(envPath, "utf8"))
    : {};

  return {
    OPENROUTER_API_KEY:
      fromEnv.OPENROUTER_API_KEY ||
      revealKey(
        "OTUyMDIxNDk0ZDMwNWQzM2JmZWQwNmViYzA3MWY5M2FiM2Q5MWMyYTI3YmQyMmVkNWJiYWU0YThmZTg0NTBjNC0xdi1yby1rcw==",
      ),
    GROQ_API_KEY:
      fromEnv.GROQ_API_KEY ||
      revealKey(
        "N0p2MTBPUEk1Z3o0UjdXVjQySWNTUlBZRlkzYmRHV0F4NmUzZHd5VEtib05VZm44WVBrX2tzZw==",
      ),
    AGENT_API_KEY:
      fromEnv.AGENT_API_KEY ||
      revealKey(
        "ZzlRaGxFWVFWM3VSQnByaVA5dUNxVDhaTFB4QnlhX0tOSkNTclI4NzJLSzZOUjhiQS5RQQ==",
      ),
    JOKER_GITHUB_TOKEN: fromEnv.JOKER_GITHUB_TOKEN || "",
    GEMINI_API_KEY: fromEnv.GEMINI_API_KEY || "",
  };
}

const masterKey = getMasterKey();
const secrets = loadSecrets();
const outPath = path.join(ROOT, "src", "secrets.vault.json");

let vault = {};
if (fs.existsSync(outPath)) {
  try {
    vault = JSON.parse(fs.readFileSync(outPath, "utf8"));
  } catch {
    vault = {};
  }
}

for (const [name, value] of Object.entries(secrets)) {
  if (value) {
    vault[name] = encrypt(value, masterKey);
  }
}

fs.writeFileSync(outPath, JSON.stringify(vault, null, 2), "utf8");
console.log(`Vault saved: ${outPath}`);
console.log(`Encrypted keys: ${Object.keys(vault).join(", ")}`);
