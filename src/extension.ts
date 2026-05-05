import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";
import * as cp from "child_process";
import * as os from "os";
import * as crypto from "crypto";

const MSIM_DEFAULT_PORT = 10505;
const MSIM_DEFAULT_PATH = "msim";
const MSIM_TERM_NAME = "MSIM";
const KERNEL_DEFAULT_PATH = "./kernel/kernel.raw";
const OUTPUT_CHANNEL_NAME = "msim-dap";
const OUTPUT_EXT_LOG_PREFIX = "[Extension]";
const OUTPUT_DAP_LOG_PREFIX = "[msim-dap] ";

export function activate(context: vscode.ExtensionContext) {
  const activateCmd = vscode.commands.registerCommand(
    "msim-debugger.activate",
    () => {
      vscode.window.showInformationMessage("Activated MSIM debugger!");
    },
  );
  context.subscriptions.push(activateCmd);

  // Output channel for msim-dap stderr logs
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(outputChannel);

  const factory: vscode.DebugAdapterDescriptorFactory = {
    async createDebugAdapterDescriptor(session: vscode.DebugSession) {
      // Resolve msim-dap binary path
      const workspace = session.workspaceFolder?.uri.fsPath;
      const binName = resolveAdapterBinName(context);
      logOutput(`Using msim-dap binary: ${binName}`);
      const exePath = context.asAbsolutePath(path.join("bin", binName));

      // Setup unique pipe
      const id = crypto.randomBytes(4).toString("hex");
      const pipePath =
        process.platform === "win32"
          ? `\\\\.\\pipe\\msim-dap-${id}`
          : path.join(os.tmpdir(), `msim-dap-${id}.sock`);

      // Check if msim running and try to start it if not
      const port: number = session.configuration.port ?? MSIM_DEFAULT_PORT;

      if (!probeMsim(port)) {
        const msimPath: string =
          session.configuration.msimPath ?? MSIM_DEFAULT_PATH;
        if (!validateMsimPath(msimPath)) {
          vscode.window.showErrorMessage(
            "MSIM is not running and not found in PATH.",
          );
          logOutput(
            `MSIM not running, also not found at path: ${msimPath}. Please start MSIM or provide a valid \`msimPath\` in the debug configuration.`,
          );
          throw new Error("MSIM not running");
        }

        const existing = vscode.window.terminals.find(
          (t) => t.name === MSIM_TERM_NAME,
        );
        const term = existing ?? vscode.window.createTerminal(MSIM_TERM_NAME);
        const portArg = port !== MSIM_DEFAULT_PORT ? `${port}` : "";
        term.sendText(`${msimPath} -d${portArg}`);
        term.show(true);

        // Wait for msim to start listening
        const ready = await waitForMsim(port, 1000);
        if (!ready) {
          vscode.window.showErrorMessage(
            "Timed out waiting for MSIM to start.",
          );
          throw new Error("MSIM start timeout");
        }
      }

      const kernelPath: string =
        session.configuration.kernelPath ?? KERNEL_DEFAULT_PATH;

      // Wire up the debug adapter server process
      const server = net.createServer((socket) => {
        const adapterArgs = [];
        if (port !== MSIM_DEFAULT_PORT) adapterArgs.push(`-m=${port}`);
        if (kernelPath !== KERNEL_DEFAULT_PATH)
          adapterArgs.push(`-p=${kernelPath}`);

        // Spawn msim-dap with the workspace as cwd
        const proc = cp.spawn(exePath, adapterArgs, {
          cwd: workspace ?? undefined,
          stdio: ["pipe", "pipe", "pipe"],
        });
        logOutput(
          `Spawned msim-dap as: \`${exePath} ${adapterArgs.join(" ")}\``,
        );

        socket.pipe(proc.stdin);
        proc.stdout.pipe(socket);

        // Log msim-dap stderr to the output channel
        proc.stderr.on("data", (data: Buffer) => {
          data
            .toString()
            .split("\n")
            .forEach((line: string) => {
              if (line)
                outputChannel.append(
                  `${OUTPUT_DAP_LOG_PREFIX} ${line.trimEnd()}\n`,
                );
            });
        });

        // Clean up on exit
        proc.on("exit", (code) => {
          outputChannel.appendLine(`\n[msim-dap exited with code ${code}]`);
          socket.destroy();
          server.close();
        });

        socket.on("close", () => {
          proc.kill();
          server.close();
        });
      });

      await new Promise<void>((resolve) => server.listen(pipePath, resolve));

      return new vscode.DebugAdapterNamedPipeServer(pipePath);
    },
  };

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("msim", factory),
  );

  // Log to the output channel (where msim-dap stderr is normally logged)
  function logOutput(log: string) {
    outputChannel.appendLine(`${OUTPUT_EXT_LOG_PREFIX} ${log}`);
  }

  function probeMsim(port: number): boolean {
    // Linux: check /proc/net/tcp for a listener on the port
    try {
      const hexPort = port.toString(16).toUpperCase().padStart(4, "0");
      const lines = fs.readFileSync("/proc/net/tcp", "utf8").split("\n");
      // Column 1: local_address, ends with :hexPort
      // Column 3: state, "0A" = LISTEN
      if (
        lines.some((l) => {
          const columns = l.trim().split(/\s+/);
          return columns[1].endsWith(`:${hexPort}`) && columns[3] === "0A";
        })
      ) {
        return true;
      }
    } catch {}

    // macOS fallback: netstat should be most reliable
    try {
      cp.execSync(`netstat -an | grep -qE '[.:]${port}[[:space:]].*LISTEN'`, {
        stdio: "ignore",
      });
      return true;
    } catch {}

    return false;
  }

  async function waitForMsim(
    port: number,
    timeoutMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (probeMsim(port)) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  }

  function validateMsimPath(msimPath: string): boolean {
    try {
      cp.execSync(`which ${msimPath}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  function resolveAdapterBinName(context: vscode.ExtensionContext): string {
    const platform = process.platform;
    const arch = process.arch;
    const binName = `msim-dap-${platform}-${arch}`;

    if (["msim-dap-linux-x64", "msim-dap-darwin-arm64"].includes(binName)) {
      if (fs.existsSync(context.asAbsolutePath(path.join("bin", binName)))) {
        return binName;
      }
    }

    const fallbackBin = "msim-dap";
    if (fs.existsSync(context.asAbsolutePath(path.join("bin", fallbackBin)))) {
      return fallbackBin;
    }

    vscode.window.showErrorMessage(
      `Unsupported platform or architecture: ${platform}-${arch}`,
    );
    throw new Error(
      `Unsupported platform or architecture: ${platform}-${arch}`,
    );
  }
}

export function deactivate() {}
