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

  const outputChannel = vscode.window.createOutputChannel("msim-dap");
  context.subscriptions.push(outputChannel);

  const factory: vscode.DebugAdapterDescriptorFactory = {
    createDebugAdapterDescriptor(session: vscode.DebugSession) {
      const workspace = session.workspaceFolder?.uri.fsPath;
      const binName = resolveBinName(context);
      logOutput(`Using msim-dap binary: ${binName}`);
      const exePath = context.asAbsolutePath(path.join("bin", binName));

      const id = crypto.randomBytes(4).toString("hex");
      const pipePath =
        process.platform === "win32"
          ? `\\\\.\\pipe\\msim-dap-${id}`
          : path.join(os.tmpdir(), `msim-dap-${id}.sock`);

      const server = net.createServer((socket) => {
        const proc = cp.spawn(exePath, [], {
          cwd: workspace ?? undefined,
          stdio: ["pipe", "pipe", "pipe"],
        });
        logOutput(`Spawned msim-dap as: \`${exePath} ${adapterArgs.join(" ")}\``);

        socket.pipe(proc.stdin);
        proc.stdout.pipe(socket);

        proc.stderr.on("data", (data: Buffer) => {
          outputChannel.append(data.toString());
        });

        outputChannel.show(true);

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

function resolveBinName(context: vscode.ExtensionContext) {
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
