// start-metro.js
// ✅ Stable ESM-compatible Metro launcher for Windows & macOS

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = __dirname;
const metroCLI = path.join(
  projectRoot,
  "node_modules",
  "@react-native-community",
  "cli",
  "build",
  "bin.js"
);

const metroConfigPath = path.resolve(projectRoot, "metro.config.js");

console.log(`🚀 Launching Metro using config: ${metroConfigPath}`);

const metroProcess = spawn(
  "node",
  [metroCLI, "start", "--config", metroConfigPath, "--reset-cache"],
  {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true, // ✅ Use shell=true for Windows compatibility
  }
);

metroProcess.on("close", (code) => {
  console.log(`🧩 Metro exited with code ${code}`);
});
