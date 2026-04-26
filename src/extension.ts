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
const OUTPUT_CHANNEL_NAME = "msim-dap";
const OUTPUT_EXT_LOG_PREFIX = "[Extension]";
const OUTPUT_DAP_LOG_PREFIX = "[msim-dap] ";

export function activate(context: vscode.ExtensionContext) {
  const activateCmd = vscode.commands.registerCommand(
    "msim-debugger.activate",
    () => {
      vscode.window.showInformationMessage("Activated MSIM debugger!");
    }
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

      const port: number = session.configuration.port ?? MSIM_DEFAULT_PORT;
      // Wire up the debug adapter server process
      const server = net.createServer((socket) => {
        const adapterArgs = [];
        if (port !== MSIM_DEFAULT_PORT) adapterArgs.push(`-m=${port}`);

        // Spawn msim-dap with the workspace as cwd
        const proc = cp.spawn(exePath, adapterArgs, {
          cwd: workspace ?? undefined,
          stdio: ["pipe", "pipe", "pipe"],
        });
        logOutput(`Spawned msim-dap as: \`${exePath} ${adapterArgs.join(" ")}\``);

        socket.pipe(proc.stdin);
        proc.stdout.pipe(socket);

        // Log msim-dap stderr to the output channel
        proc.stderr.on("data", (data: Buffer) => {
          data.toString().split("\n").forEach((line: string) => {
            if (line) outputChannel.append(`${OUTPUT_DAP_LOG_PREFIX} ${line.trimEnd()}\n`);
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

      server.listen(pipePath);

      return new vscode.DebugAdapterNamedPipeServer(pipePath);
    },
  };

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("msim", factory)
  );

  // Log to the output channel (where msim-dap stderr is normally logged)
  function logOutput(log: string) {
    outputChannel.appendLine(`${OUTPUT_EXT_LOG_PREFIX} ${log}`);
  }
}

export function deactivate() {}

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
    `Unsupported platform or architecture: ${platform}-${arch}`
  );
  throw new Error(`Unsupported platform or architecture: ${platform}-${arch}`);
}
