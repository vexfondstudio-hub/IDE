import crypto from "crypto";
import vault from "./secrets.vault.json";

const VAULT_SALT = "joker-ide-vault-v1";
const PASSPHRASE = "JkR-v4ult-9xK2mP7nQ4wL8sT1fH6cB3dG0aE5";

type VaultEntry = { iv: string; tag: string; data: string };
type VaultKey =
  | "OPENROUTER_API_KEY"
  | "GROQ_API_KEY"
  | "AGENT_API_KEY"
  | "JOKER_GITHUB_TOKEN"
  | "GEMINI_API_KEY";

const cache = new Map<string, string>();

function getMasterKey(): Buffer {
  return crypto.scryptSync(PASSPHRASE, VAULT_SALT, 32);
}

function decrypt(entry: VaultEntry): string {
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(entry.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(entry.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(entry.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function getSecret(name: VaultKey): string {
  const envOverride = process.env[name];
  if (envOverride) return envOverride;

  if (cache.has(name)) return cache.get(name)!;

  const entry = (vault as Record<string, VaultEntry>)[name];
  if (!entry) return "";

  const value = decrypt(entry);
  cache.set(name, value);
  return value;
}

export const SECRETS = {
  get openrouter() {
    return getSecret("OPENROUTER_API_KEY");
  },
  get groq() {
    return getSecret("GROQ_API_KEY");
  },
  get agent() {
    return getSecret("AGENT_API_KEY");
  },
  get github() {
    return getSecret("JOKER_GITHUB_TOKEN");
  },
  get gemini() {
    return getSecret("GEMINI_API_KEY");
  },
};
