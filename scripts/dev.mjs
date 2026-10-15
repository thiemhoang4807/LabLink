import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!existsSync(python)) {
  console.error("Chưa có .venv. Hãy tạo môi trường Python và cài apps/api/requirements.txt theo README.md.");
  process.exit(1);
}

const children = [];
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid && child.exitCode === null) {
      if (process.platform === "win32") {
        // Terminate uvicorn's reload subprocess and Vite as well as their parents.
        spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      } else {
        try { process.kill(-child.pid, "SIGTERM"); } catch { /* The child has already stopped. */ }
      }
    }
  }
  process.exitCode = code;
};
const launch = (command, args, cwd, shell = false) => {
  const child = spawn(command, args, {
    cwd, stdio: "inherit", shell, detached: process.platform !== "win32", windowsHide: true,
  });
  children.push(child);
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code ?? 1); });
};

console.log("LabLink: API http://localhost:8000/docs · Web http://localhost:5173");
launch(python, ["-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"], path.join(root, "apps", "api"));
// npm.cmd requires the Windows shell; fixed arguments never include user content.
launch(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev:web"], root, process.platform === "win32");
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
