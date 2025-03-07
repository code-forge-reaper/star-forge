// terminal.ts
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { uint8ArrayToBase64, vfs, resolvePath, getParentDirectory } from "../common";
import setupNova from "./apps/nova-interp";
const applications: { [name: string]: { description: string, callBack: Function } } = {}
const terminal = {
	cwd: "/",
	registerApp: (name: string, description: string, callBack: Function) => applications[name] = { description, callBack },
	echo: (data: string | Uint8Array, callback?: () => void): void => {}
}

const applicationsToRegister: Function[] = [setupNova]

/**
 * Creates a new terminal window instance.
 */
export function createTerminalWindow(): HTMLElement {
	// Create a container for the terminal
	const container = document.createElement("div");
	container.classList.add("terminal-container");

	// Create an inner div to host the xterm terminal
	const termDiv = document.createElement("div");
	termDiv.style.flexGrow = "1";
	container.appendChild(termDiv);

	// Instantiate the xterm.js Terminal
	const term = new Terminal({
		cursorBlink: true,
		scrollback: 1000,
		tabStopWidth: 4,
	});
	term.open(termDiv);
	setTimeout(() => term.focus(), 10);
	terminal.echo = term.writeln

	// Set up shell commands (with auto complete support).
	setupTerminalCommands(term);

	return container;
}

/**
 * Sets up the interactive command shell for the terminal.
 */
function setupTerminalCommands(term: Terminal) {
	let inputBuffer = "";
	// List of available commands.
	const commands = ["help", "clear", "pwd", "ls", "cd", "mkdir", "cat", "touch", "rm"];

	// Display the initial prompt.
	prompt();

	// Listen for terminal input.
	term.onData((data) => {
		switch (data) {
			case "\r": // Enter key
				term.write("\r\n");
				handleCommand(inputBuffer);
				inputBuffer = "";
				prompt();
				break;
			case "\u0009": // Tab key (\t)
				autoComplete();
				break;
			case "\u007F": // Backspace (DEL)
				// Do not allow deletion beyond current inputBuffer.
				if (inputBuffer.length > 0) {
					inputBuffer = inputBuffer.slice(0, -1);
					term.write("\b \b");
				}
				break;
			default:
				inputBuffer += data;
				term.write(data);
		}
	});

	/**
	 * Displays the prompt with the current working directory.
	 */
	function prompt() {
		term.write(`\r\n${terminal.cwd} $ `);
	}

	/**
	 * Handles the entered command string.
	 */
	async function handleCommand(command: string) {
		const args = command.trim().split(" ").filter((a) => a.length > 0);
		if (args.length === 0) return;

		const cmd = args[0];
		const params = args.slice(1);
		switch (cmd) {
			case "help":
				term.writeln("Available commands:");
				term.writeln("  help               Show available commands.");
				term.writeln("  clear              Clear the terminal.");
				term.writeln("  pwd                Print the working directory.");
				term.writeln("  ls [dir]           List files in directory (default: current directory).");
				term.writeln("  cd [dir]           Change current directory (default: '/').");
				term.writeln("  mkdir <dir>        Create a new directory.");
				term.writeln("  cat <file>         View a file's contents (if text).");
				term.writeln("  touch <file>       Create an empty file.");
				term.writeln("  rm <file/dir>      Remove a file or an empty directory.");
				if (Object.keys(applications).length > 0) {
					term.writeln("Available console applications:");

					for (let cmd of Object.keys(applications)) {
						term.writeln(` ${cmd}    ${applications[cmd].description}`)
					}
				}
				break;
			case "clear":
				term.clear();
				break;
			case "pwd":
				term.writeln(terminal.cwd);
				break;
			case "ls":
				{
					let target = terminal.cwd;
					if (params.length > 0) {
						target = resolvePath(terminal.cwd, params[0]);
						// Handle ".." in path
						if (params[0] === "..") {
							target = getParentDirectory(terminal.cwd);
						}
					}
					const list = vfs.listDirectory(target);
					if (list == null) {
						term.writeln("Directory not found.");
					} else if (list.length === 0) {
						term.writeln("Directory is empty.");
					} else {
						term.writeln(list.join("   "));
					}
				}
				break;
			case "cd":
				{
					if (params.length === 0) {
						terminal.cwd = "/";
					} else {
						let target = resolvePath(terminal.cwd, params[0]);
						// Handle ".." in path
						if (params[0] === "..") {
							target = getParentDirectory(terminal.cwd);
						}

						// Check if target exists and is a directory.
						const metadata = vfs.getMetadata(target);
						if (!metadata) {
							term.writeln(`No such directory: ${target}`);
						} else {
							// Using ls to verify it's a directory.
							const list = vfs.listDirectory(target);
							if (list === null) {
								term.writeln(`${target} is not a directory`);
							} else {
								terminal.cwd = target;
							}
						}
					}
				}
				break;
			case "mkdir":
				{
					if (params.length === 0) {
						term.writeln("Usage: mkdir <directory>");
					} else {
						const dirPath = resolvePath(terminal.cwd, params[0]);
						const success = vfs.createDirectory(dirPath);
						if (success) {
							term.writeln(`Directory ${dirPath} created.`);
						} else {
							term.writeln(`Failed to create directory ${dirPath}.`);
						}
					}
				}
				break;
			case "cat":
				{
					if (params.length === 0) {
						term.writeln("Usage: cat <file>");
					} else {
						const filePath = resolvePath(terminal.cwd, params[0]);
						const metadata = vfs.getMetadata(filePath);
						if (!metadata) {
							term.writeln("File not found or is not a file.");
						} else if (!metadata.fileType?.startsWith("text/")) {
							term.writeln("<binary>");
						} else {
							const content = vfs.readFile(filePath);
							if (content === null) {
								term.writeln("File not found or is not a file.");
							} else {
								const decoder = new TextDecoder();
								term.writeln(decoder.decode(content));
							}
						}
					}
				}
				break;
			case "touch":
				{
					if (params.length === 0) {
						term.writeln("Usage: touch <file>");
					} else {
						const filePath = resolvePath(terminal.cwd, params[0]);
						const success = vfs.writeFile(filePath, new Uint8Array());
						if (success) {
							term.writeln(`File ${filePath} created.`);
						} else {
							term.writeln(`Failed to create file ${filePath}.`);
						}
					}
				}
				break;
			case "rm":
				{
					if (params.length === 0) {
						term.writeln("Usage: rm <file/directory>");
					} else {
						const target = resolvePath(terminal.cwd, params[0]);
						const success = vfs.deleteNode(target);
						if (success) {
							term.writeln(`Removed ${target}.`);
						} else {
							term.writeln(`Failed to remove ${target}. The directory may not be empty or it may not exist.`);
						}
					}
				}
				break;
			default:
				if (!applications[cmd])
					term.writeln(`Command not found: ${cmd}`);
				else
					applications[cmd].callBack(...params)
		}
	}


	/**
	 * Completes the current token in the inputBuffer.
	 * For the first token, matches against available commands.
	 * For subsequent tokens, uses files/directories from the virtual FS.
	 */
	function autoComplete() {
		// Split the inputBuffer to work on the last token.
		const tokens = inputBuffer.split(" ");
		if (tokens.length === 0) return;
		const lastToken = tokens[tokens.length - 1];

		// If we're completing the command (first token)
		if (tokens.length === 1) {
			const candidates = commands.filter((cmd) => cmd.startsWith(lastToken));
			if (candidates.length === 1) {
				const completion = candidates[0].substring(lastToken.length);
				inputBuffer += completion;
				term.write(completion);
			} else if (candidates.length > 1) {
				term.write("\r\n" + candidates.join("   ") + "\r\n");
				prompt();
				term.write(inputBuffer);
			}
		} else {
			// Otherwise, we are completing a file or directory name.
			// Split last token into directory and file part by the last "/".
			let dirPath = "";
			let filePart = "";
			const lastSlashIndex = lastToken.lastIndexOf("/");
			if (lastSlashIndex !== -1) {
				dirPath = lastToken.substring(0, lastSlashIndex);
				filePart = lastToken.substring(lastSlashIndex + 1);
			} else {
				filePart = lastToken;
			}
			let searchDir = terminal.cwd;
			if (dirPath) {
				searchDir = resolvePath(terminal.cwd, dirPath);
			}
			const list = vfs.listDirectory(searchDir);
			if (!list) return;

			const candidates = list.filter((item) => item.startsWith(filePart));
			if (candidates.length === 1) {
				const completion = candidates[0].substring(filePart.length);
				// Append the completion only to the last token.
				inputBuffer += completion;
				term.write(completion);
			} else if (candidates.length > 1) {
				term.write("\r\n" + candidates.join("   ") + "\r\n");
				prompt();
				term.write(inputBuffer);
			}
		}
	}

	applicationsToRegister.forEach(e => e(terminal))
}

/**
 * Creates the Terminal icon button and attaches the terminal window.
 */
export function CreateTerminal(iconsContainer: HTMLElement, createWindow: Function) {
	// Add the Terminal icon (static).
	const openTerminal = document.createElement("button");

	openTerminal.classList.add("desktop-icon");

	openTerminal.innerHTML = `<img src="data:image/svg+xml;base64,${uint8ArrayToBase64(
		vfs.readFile("/Icons/terminal.svg")
	)}" alt="Terminal" style="width: 64px; height: 64px; display: block; margin: 0 auto;">
    <span style="text-align: center; display: block;">Terminal</span>`;
	openTerminal.onclick = () => {
		const terminalContent = createTerminalWindow();
		createWindow("Terminal", "Terminal", terminalContent);
	};
	iconsContainer.appendChild(openTerminal);
}