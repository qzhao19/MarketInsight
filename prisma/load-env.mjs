import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname and __filename on ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get root dir
const rootDir = path.resolve(__dirname, "..");
const envDbPath = path.join(rootDir, "env", ".env.db");

// Check env/.env.db is existed
if (!fs.existsSync(envDbPath)) {
  console.error(`Error: env/.env.db file not found at ${envDbPath}`);
  process.exit(1);
}

// Read env/.env.db file
const envContent = fs.readFileSync(envDbPath, "utf-8");

const lines = envContent.split("\n");
lines.forEach((line) => {
  // Skip comment and whitespace
  if (line.startsWith("#") || !line.trim()) {
    return;
  }

  // Read KEY=VALUE
  const [key, ...valueParts] = line.split("=");
  const value = valueParts.join("=").trim().replace(/^[""]|[""]$/g, "");

  // Setup environment vars
  if (!process.env[key]) {
    process.env[key] = value;
    console.log(`Loaded from env/.env.db: ${key}`);
  }
});

// Check key variable
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

console.log(`Database URL configured: ${process.env.DATABASE_URL}`);