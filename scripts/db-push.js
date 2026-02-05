/**
 * Loads .env.local, fixes DATABASE_URL if the password contains special
 * characters (so Prisma doesn't fail with "invalid port number"), then runs
 * Prisma db push.
 */
const { config } = require("dotenv");
const { resolve } = require("path");
const { spawnSync } = require("child_process");

config({ path: resolve(process.cwd(), ".env.local") });

let url = process.env.DATABASE_URL;
if (url && url.startsWith("postgresql://")) {
  try {
    const match = url.match(/^postgresql:\/\/([^/]+)\/(.*)$/);
    if (match) {
      const authority = match[1];
      const path = match[2];
      const atIndex = authority.lastIndexOf("@");
      if (atIndex !== -1) {
        const userPass = authority.slice(0, atIndex);
        const hostPort = authority.slice(atIndex + 1);
        const colonIndex = userPass.indexOf(":");
        const user = colonIndex === -1 ? userPass : userPass.slice(0, colonIndex);
        const password = colonIndex === -1 ? "" : userPass.slice(colonIndex + 1);
        const encodedPassword = encodeURIComponent(password);
        url = `postgresql://${user}:${encodedPassword}@${hostPort}/${path}`;
        process.env.DATABASE_URL = url;
      }
    }
  } catch (_) {
    // leave DATABASE_URL as-is
  }
}

const result = spawnSync(
  "npx",
  ["prisma", "db", "push"],
  { stdio: "inherit", env: process.env }
);
process.exit(result.status ?? 1);
