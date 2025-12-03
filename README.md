# msim-debugger extension

Debugging extension for MSIM simulator in VS Code.

## Building the Extension

Currently, this extension is not published to the VS Code marketplace. To use it, you need to package and install it manually, which is thankfully very straightforward.

The process has 4 easy steps:

1. Obtain a `msim-dap` adapter binary for your platform.  
This is a DAP (Debug Adapter Protocol) server binary that communicates between VS Code and the MSIM simulator written in Rust. Currently, you need to build it yourself from the
[msim-dap repository](https://github.com/0xVector/msim-dap). Follow the instructions there.


2. Copy your build `msim-dap` binary into this repository's [`bin/`](./bin/) directory

3. Package the extension together with the binary.  
This is done using a Node.js tool. You need Node, if you don't have it, [install it](https://nodejs.org/en/download).

Then, run this command in the root of this repository:
```sh
npx @vscode/vsce package
```

4. Now, take the generated [`msim-debugger-0.0.1.vsix`](msim-debugger-0.0.1.vsix) file and install it in VS Code using the "Install from VSIX..." option in the Extensions view (in the dropdown menu in the top-right corner under `...`).

Done! You can now use the extension in your VS Code.

Hopefully, in the future, you there will be a pre-packaged version of the extension available (or even published to the extension marketplace), so you won't have to go through this process.

## Features

- breakpoints: you can set breakpoints in C source files and MSIM will stop the execution when it hits them

## Tips

When you start debugging, VS Code by default opens the Debug Console. This is useless as you will most likely
have the MSIM simulator open in the terminal and want to see it while debugging, which means you have to click
back to the terminal.  
To disable this annoying behavior, change the **Debug: Internal Console Options** setting (`debug.internalConsoleOptions`) for the workspace.

You can also manually add this to your workspace `.vscode/settings.json`:
```js
{
"debug.internalConsoleOptions": "neverOpen"
}
```

## Known Issues

The extension will not stop the debug session after MSIM exits automatically, you need to click the disconnect/stop button manually.

## Release Notes

- v0.0.1
  - Initial release of MSIM Debugger extension for VS Code
