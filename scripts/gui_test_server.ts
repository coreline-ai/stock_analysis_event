import { spawn } from "node:child_process";

interface GuiServerHandle {
  started: boolean;
  cleanup: () => Promise<void>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function stopProcessTree(pid: number): Promise<void> {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      return;
    }
  }

  for (let i = 0; i < 20; i += 1) {
    await sleep(100);
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
  }

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // no-op
    }
  }
}

export async function ensureGuiTestServer(baseUrl: string): Promise<GuiServerHandle> {
  if (await isServerReady(baseUrl)) {
    return { started: false, cleanup: async () => {} };
  }

  const parsed = new URL(baseUrl);
  const port = parsed.port || "3333";
  const npmBin = process.env.NPM_BIN || "npm";
  const child = spawn(npmBin, ["run", "-s", "dev:3333:all"], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-dev",
      PORT: port,
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://deepstock:deepstock@127.0.0.1:15432/deepstock",
      API_TOKEN: process.env.API_TOKEN ?? process.env.DEEPSTOCK_API_TOKEN ?? "dev-token",
      DEEPSTOCK_API_TOKEN: process.env.DEEPSTOCK_API_TOKEN ?? process.env.API_TOKEN ?? "dev-token"
    }
  });
  child.unref();

  const pid = child.pid;
  if (!pid) {
    throw new Error("failed_to_start_gui_test_server");
  }

  for (let i = 0; i < 120; i += 1) {
    if (await isServerReady(baseUrl)) {
      return {
        started: true,
        cleanup: async () => stopProcessTree(pid)
      };
    }
    await sleep(1000);
  }

  await stopProcessTree(pid);
  throw new Error(`gui_test_server_not_ready: ${baseUrl}`);
}
