# MSIM debugger extension

Debugger extension for MSIM simulator in VS Code.

This extension provides debugging capabilities for C programs running in the
[MSIM](https://github.com/d-iii-s/msim) via the [Debug Adapter Protocol (DAP)](https://microsoft.github.io/debug-adapter-protocol/).

## Installation

Currently, this extension is not published to the VS Code marketplace. To use it, you need to install it manually, which is very straightforward. You have two options: using a pre-packaged version of the extension, or building and packaging it yourself.

### Pre-packaged Version

A pre-packaged version of this extension is available in the [`releases`](https://github.com/0xVector/msim-debugger/releases) page. Download the latest `msim-debugger-v*.vsix` file and install it in VS Code using the "Install from VSIX..." option in the Extensions view (in the dropdown menu in the top-right corner under `...`).

The extension has the `msim-dap` binary bundled for Linux `x86` and macOS `arm64`. For these platforms, you can just install the extension and start immediatelly using it.

#### Note for macOS

Due to macOS security restrictions, you might need to manually allow the `msim-dap` binary to run the first time you use the extension.  
To do this, try to start a debugging session. When it fails, you need to locate your VS Code extensions folder (usually in `~/.vscode/extensions/`), find the `msim-debugger` extension folder, then go to `bin/`. Then, run:
```sh
xattr -d com.apple.quarantine msim-dap-darwin-arm64
```

#### Other Platforms

If you want to try using the extension on other platforms (do note that it is untested and not explicitly supported), you can either build and package
it yourself (see below), or use the pre-packaged extension and place a `msim-dap` binary for your platform
in the `bin/` folder of the extension installation directory.

### Packaging the Extension Manually

If you want to use the extension on a platform that is not supported by the pre-packaged version or just want to build it yourself, you can do so by following the instructions below.

The process of building and packaging the extension yourself has 4 easy steps:

1. Obtain a `msim-dap` adapter binary for your platform.  
This is a DAP (Debug Adapter Protocol) server binary that communicates between VS Code and the MSIM simulator written in Rust. Currently, you need to build it yourself from the
[msim-dap repository](https://github.com/0xVector/msim-dap). Follow the instructions there.


2. Clone this repository and copy your built `msim-dap` binary into this repository's [`bin/`](./bin/) directory.  
Make sure it is named `msim-dap` and is executable.

3. Package the extension together with the binary.  
This is done using a Node.js tool. You need Node and npm, if you don't have it, [install it](https://nodejs.org/en/download) first.

Then, run this in the root of this repository:
```sh
npm install
npm run package
```
It will install the VS Code packaging tool and package the extension.

4. Now, take the generated [`msim-debugger-0.0.1.vsix`](msim-debugger-0.0.1.vsix) file and install it in VS Code using the "Install from VSIX..." option in the Extensions view (in the dropdown menu in the top-right corner under `...`).

Done! You can now use the extension in your VS Code.

## Updating the Extension

The extension doesn't have an auto-update mechanism, so you need to repeat the installation process. You might need to **Reload Window** in VS Code command palette after installing the new version.

## Features

- breakpoints: you can set breakpoints in C source files and MSIM will stop the execution and show you the current line when it hits a breakpoint
- continue / pause: you can continue the execution until the next breakpoint or pause it at any time

## Usage

### Configuration

As with any debugger in VS Code, you need to create a debug configuration (`launch.json` file) in your workspace.  
The extension provides a default configuration for MSIM which will work out of the box. You can create
it by going to the Debug view in VS Code, clicking on "create a launch.json file", and selecting "MSIM Debugger" from the list. This create the config in `.vscode/launch.json`.

If you already have a `launch.json`, either delete it and recreate it as above, or manually add a configuration like this:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "MSIM debug default config",
      "type": "msim",
      "request": "attach",
      "msimPath": "msim", // Path to the MSIM binary, defaults to 'msim' (resolved from PATH).
      "port": 10505 // Port to connect to the MSIM DAP server, defaults to 10505.
    }
  ]
}
```

### Starting MSIM and Debugging

Then, start MSIM. If you don't start MSIM yourself, the extension will start it for you.  
**Important:** if you're starting MSIM yourself, make sure to use the `-d` flag to enable the DAP server:
```sh
msim -d
```
Also note that when using a custom port in `launch.json` config, you need to specify the same port when starting MSIM: `msim -d<port>`. See `msim -h` for more details.

MSIM will wait for VS Code to connect to it. You can start debugging in VS Code by selecting the "MSIM debug default config" configuration and clicking the green debug button.

### Breakpoints

To set breakpoints, just set them in your C source files as you would with any other debugger in VS Code.

MSIM will stop the execution and show you the current line when it hits a breakpoint. You can then continue the execution using the standard debug controls in VS Code.

## Known Issues

- 

## Release Notes

- v0.0.1
  - Initial release of MSIM Debugger extension for VS Code
