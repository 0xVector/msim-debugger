import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  const activateCmd = vscode.commands.registerCommand(
    "msim-debugger.activate",
    () => {
      vscode.window.showInformationMessage("Activated MSIM debugger!");
    }
  );
  context.subscriptions.push(activateCmd);

  const factory: vscode.DebugAdapterDescriptorFactory = {
    createDebugAdapterDescriptor(session: vscode.DebugSession) {
      const workspace = session.workspaceFolder?.uri.fsPath;
      const binName = resolveBinName(context);
      vscode.window.showInformationMessage(`Using msim-dap binary: ${binName}`);
      const exePath = context.asAbsolutePath(path.join("bin", binName));

      const options: vscode.DebugAdapterExecutableOptions = {
        cwd: workspace ?? undefined,
      };

      return new vscode.DebugAdapterExecutable(exePath, [], options);
    },
  };

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("msim", factory)
  );

  console.log("msim-debugger activated!");
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
