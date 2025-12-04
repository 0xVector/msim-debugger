import * as vscode from "vscode";
import * as path from "path";

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
      const exePath = context.asAbsolutePath(path.join("bin", "msim-dap"));

      const options: vscode.DebugAdapterExecutableOptions = {
        cwd: workspace ?? undefined
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
