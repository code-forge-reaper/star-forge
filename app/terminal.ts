// terminal.ts
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import setupLua from "./apps/lua";
import setupNova from "./apps/nova-interp";
import {
	FS,
	cDir,
	resolvePath,
	getFSObject,
	createFile,
	GET_CDIR_FILES,
	setCDir,
	notifyFSChange,
} from "./filesystem";

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
	const term = new Terminal();
	term.open(termDiv);

	// Set up the prompt and state variables for this terminal instance
	let PROMPT = `cross@<redacted> in / $ `;
	term.write(PROMPT);
	let buff = "";
	let commandHistory: string[] = [];
	let historyIndex = commandHistory.length;

	// Registered applications (commands)
	const APPLICATIONS: Record<
		string,
		{ description: string; callback: (...args: string[]) => number }
	> = {};

	// Minimal terminal API functions
	function echo(arg: string) {
		term.writeln(arg);
	}

	function colorText(text: string, color: string): string {
		let code: string;
		switch (color.toLowerCase()) {
			case "red":
				code = "\x1B[31m";
				break;
			case "green":
				code = "\x1B[32m";
				break;
			case "yellow":
				code = "\x1B[33m";
				break;
			case "blue":
				code = "\x1B[34m";
				break;
			case "magenta":
				code = "\x1B[35m";
				break;
			case "cyan":
				code = "\x1B[36m";
				break;
			default:
				code = "";
		}
		return code + text + "\x1B[0m";
	}

	function registerApp(
		name: string,
		description: string,
		callback: (...args: string[]) => number
	) {
		if (APPLICATIONS[name])
			term.writeln(
				`\x1B[1;3;31mone of your loaded apps attempted to overwrite ${name}\x1B[0m`
			);
		APPLICATIONS[name] = { description, callback };
	}

	function getCwd() {
		return cDir.length === 1 ? "/" : "/" + cDir.slice(1).join("/");
	}

	// Register built‑in commands
	registerApp("help", "displays this message", (...args) => {
		term.writeln("this is still a wip website");
		term.writeln("commands:");
		for (let app in APPLICATIONS) {
			echo(`${app}  -  ${APPLICATIONS[app].description}`);
		}
		return 0;
	});

	registerApp("clear", "clears the screen", (...args) => {
		term.clear();
		return 0;
	});

	registerApp("cd", "changes the current directory", (...paths) => {
		for (let arg of paths) {
			if (arg.startsWith("--")) {
				term.writeln(`unknown option: ${arg}`);
				return 1;
			}
		}
		if (paths.length === 0) {
			setCDir(["/"]);
		} else {
			if (paths.length > 1) {
				echo("too many arguments");
				return 1;
			}
			const newPath = resolvePath(paths[0], cDir);
			const node = getFSObject(newPath);
			if (node === undefined) {
				echo(`cd: no such file or directory: ${paths[0]}`);
				return 1;
			}
			if (typeof node !== "object") {
				echo(`cd: not a directory: ${paths[0]}`);
				return 1;
			}
			setCDir(newPath);
		}
		PROMPT = `cross@<redacted> in ${getCwd()} $ `;
		return 0;
	});

	registerApp("ls", "lists the files in the current directory", (...paths) => {
		for (let arg of paths) {
			if (arg.startsWith("--")) {
				term.writeln(`unknown option: ${arg}`);
				return 1;
			}
		}
		if (paths.length === 0) {
			let node = getFSObject(cDir);
			if (node && typeof node === "object") {
				for (let file of Object.keys(node)) echo(file);
			}
		} else {
			const resolvedPath = resolvePath(paths[0], cDir);
			const node = getFSObject(resolvedPath);
			if (node === undefined) {
				echo(`ls: cannot access '${paths[0]}': No such file or directory`);
				return 1;
			}
			if (typeof node === "object") {
				for (let file of Object.keys(node)) echo(file);
			} else {
				echo(paths[0]);
			}
		}
		return 0;
	});

	registerApp("cat", "outputs the content of the given files", (...paths) => {
		if (paths.length === 0) {
			return 1;
		}
		for (let filePath of paths) {
			const resolvedPath = resolvePath(filePath, cDir);
			const node = getFSObject(resolvedPath);
			if (node === undefined) {
				echo(`cat: ${filePath}: No such file or directory`);
			} else if (typeof node === "object") {
				echo(`cat: ${filePath}: Is a directory`);
			} else {
				echo(node);
			}
		}
		return 0;
	});

	registerApp("mkdir", "creates a new directory", (...args) => {
		if (args.length === 0) {
			echo("Usage: mkdir [directory]");
			return 1;
		}
		for (let dirPath of args) {
			const resolvedPath = resolvePath(dirPath, cDir);
			if (resolvedPath.length <= 1) {
				echo(`mkdir: cannot create directory '${dirPath}': Invalid path`);
				return 1;
			}
			const parentPath = resolvedPath.slice(0, -1);
			const dirName = resolvedPath[resolvedPath.length - 1];
			const parent = getFSObject(parentPath);
			if (!parent) {
				echo(`mkdir: cannot create directory '${dirPath}': Parent directory does not exist`);
				return 1;
			}
			if (typeof parent !== "object") {
				echo(`mkdir: cannot create directory '${dirPath}': Parent is not a directory`);
				return 1;
			}
			if (dirName in parent) {
				echo(`mkdir: cannot create directory '${dirPath}': File or directory already exists`);
				return 1;
			}
			parent[dirName] = {};
		}
		notifyFSChange()
		return 0;
	});

	registerApp("touch", "creates a new file", (...args) => {
		if (args.length < 1) {
			echo("Usage: touch <file>");
			return 1;
		}
		const filePath = args[0];
		try {
			createFile(filePath, "");
		} catch (e) {
			echo(`${e}`)
			return 1
		}
		return 0;
	});

	registerApp("rm", "removes a file or a directory (use -r for directories)", (...args) => {
		if (args.length === 0) {
			echo("Usage: rm [-r] <file/directory>");
			return 1;
		}

		const recursive = args.includes("-r");
		const paths = args.filter(arg => arg !== "-r");

		for (let path of paths) {
			const resolvedPath = resolvePath(path, cDir);
			if (resolvedPath.length <= 1) {
				echo(`rm: cannot remove '${path}': Invalid path`);
				return 1;
			}
	    
			const parentPath = resolvedPath.slice(0, -1);
			const name = resolvedPath[resolvedPath.length - 1];
			const parent = getFSObject(parentPath);

			if (!parent || typeof parent !== "object" || !(name in parent)) {
				echo(`rm: cannot remove '${path}': No such file or directory`);
				return 1;
			}

			if (typeof parent[name] === "object" && Object.keys(parent[name]).length > 0 && !recursive) {
				echo(`rm: cannot remove '${path}': Directory not empty (use -r)`);
				return 1;
			}

			delete parent[name];
		}

		notifyFSChange();
		return 0;
	});
	registerApp("mv", "moves or renames a file/directory", (source, dest) => {
		if (!source || !dest) {
			echo("Usage: mv <source> <destination>");
			return 1;
		}

		const srcPath = resolvePath(source, cDir);
		const destPath = resolvePath(dest, cDir);

		if (srcPath.length <= 1) {
			echo(`mv: cannot move '${source}': Invalid path`);
			return 1;
		}

		const srcParentPath = srcPath.slice(0, -1);
		const srcName = srcPath[srcPath.length - 1];
		const srcParent = getFSObject(srcParentPath);

		if (!srcParent || typeof srcParent !== "object" || !(srcName in srcParent)) {
			echo(`mv: cannot move '${source}': No such file or directory`);
			return 1;
		}

		const destParentPath = destPath.slice(0, -1);
		const destName = destPath[destPath.length - 1];
		const destParent = getFSObject(destParentPath);
		const destObject = getFSObject(destPath);

		if (!destParent || typeof destParent !== "object") {
			echo(`mv: cannot move '${source}': Destination directory does not exist`);
			return 1;
		}

		// If destination is a directory, move inside it
		if (typeof destObject === "object") {
			destObject[srcName] = srcParent[srcName];
		} else {
			destParent[destName] = srcParent[srcName];
		}

		delete srcParent[srcName];
		notifyFSChange();
		return 0;
	});
	function deepCopy(obj: any): any {
		if (typeof obj !== "object" || obj === null) return obj;
		const copy: any = Array.isArray(obj) ? [] : {};
		for (let key in obj) {
			copy[key] = deepCopy(obj[key]);
		}
		return copy;
	}

	registerApp("cp", "copies a file or directory (use -r for directories)", (...args) => {
		if (args.length < 2) {
			echo("Usage: cp [-r] <source> <destination>");
			return 1;
		}

		const recursive = args.includes("-r");
		const paths = args.filter(arg => arg !== "-r");

		if (paths.length !== 2) {
			echo("cp: requires exactly two arguments");
			return 1;
		}

		const [source, dest] = paths;
		const srcPath = resolvePath(source, cDir);
		const destPath = resolvePath(dest, cDir);
		const srcObject = getFSObject(srcPath);
		const destObject = getFSObject(destPath);
		const destParentPath = destPath.slice(0, -1);
		const destName = destPath[destPath.length - 1];
		const destParent = getFSObject(destParentPath);

		if (!srcObject) {
			echo(`cp: cannot copy '${source}': No such file or directory`);
			return 1;
		}

		if (typeof srcObject === "object" && !recursive) {
			echo(`cp: -r not specified; omitting directory '${source}'`);
			return 1;
		}

		if (!destParent || typeof destParent !== "object") {
			echo(`cp: cannot copy to '${dest}': Destination directory does not exist`);
			return 1;
		}

		if (typeof destObject === "object") {
			// Copy into directory
			destObject[source.split("/").pop()!] = deepCopy(srcObject);
		} else {
			// Overwrite or create new
			destParent[destName] = deepCopy(srcObject);
		}

		notifyFSChange();
		return 0;
	});

	// Register external applications (such as Lua and Nova)
	const ApplicationsToRegister = [setupLua, setupNova];
	const TERMINAL = {
		echo,
		registerApp,
		getCwd,
		resolvePath,
		getFSObject,
		createFile,
		GET_CDIR_FILES,
		colorText,
	};
	for (let app of ApplicationsToRegister) {
		app(TERMINAL);
	}

	// Handle input and key events
	term.onKey((e) => {
		if (e.domEvent.key === "ArrowUp") {
			if (commandHistory.length > 0 && historyIndex > 0) {
				historyIndex--;
				buff = commandHistory[historyIndex];
				term.write("\r" + PROMPT + buff + " ".repeat(10) + "\r" + PROMPT + buff);
			}
			return;
		} else if (e.domEvent.key === "ArrowDown") {
			if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
				historyIndex++;
				buff = commandHistory[historyIndex];
			} else {
				buff = "";
				historyIndex = commandHistory.length;
			}
			term.write("\r" + PROMPT + buff + " ".repeat(10) + "\r" + PROMPT + buff);
			return;
		}

		if (e.domEvent.key === "Enter") {
			term.writeln("");
			if (buff.trim()) {
				commandHistory.push(buff);
				historyIndex = commandHistory.length;
				const parts = buff.trim().split(/\s+/g);
				const command = parts[0];
				if (APPLICATIONS[command]) {
					const exitCode = APPLICATIONS[command].callback(...parts.slice(1)) || 0;
					if (exitCode !== 0) {
						term.writeln(
							colorText(
								`"${command}" exited with non-zero error code: ${exitCode}`,
								"red"
							)
						);
					}
				} else {
					term.writeln(colorText(`unknown command "${command}"`, "red"));
				}
			}
			term.write(PROMPT);
			buff = "";
		} else if (e.domEvent.key === "Backspace") {
			if (buff.length > 0) {
				buff = buff.slice(0, -1);
				term.write("\b \b");
			}
		} else if (e.domEvent.key === "Tab") {
			e.domEvent.preventDefault();
			const tokens = buff.trim().split(/\s+/);
			if (tokens.length === 0) return;
			let lastToken = tokens[tokens.length - 1];
			let completions: string[] = [];
			if (tokens.length === 1) {
				completions = Object.keys(APPLICATIONS).filter((cmd) =>
					cmd.startsWith(lastToken)
				);
			} else {
				let basePath = "";
				let prefix = lastToken;
				const slashIndex = lastToken.lastIndexOf("/");
				if (slashIndex !== -1) {
					basePath = lastToken.substring(0, slashIndex + 1);
					prefix = lastToken.substring(slashIndex + 1);
				}
				const baseResolved =
					basePath === "" ? cDir.slice() : resolvePath(basePath, cDir);
				const node = getFSObject(baseResolved);
				if (node && typeof node === "object") {
					completions = Object.keys(node)
						.filter((item) => item.startsWith(prefix))
						.map((item) => basePath + item);
				}
			}
			if (completions.length === 1) {
				tokens[tokens.length - 1] = completions[0];
				buff = tokens.join(" ") + " ";
				term.write("\r" + PROMPT + buff);
			} else if (completions.length > 1) {
				echo("");
				echo(completions.join("    "));
				term.write("\r" + PROMPT + buff);
			}
		} else {
			if (e.key === "\x03") {
				// Handle Ctrl-C
				echo(buff + "^C");
				buff = "";
				term.write(PROMPT);
			} else {
				buff += e.key;
				term.write(e.key);
			}
		}
	});

	term.focus();
	return container;
}

export function CreateTerminal(iconsContainer, createWindow, createClickableIcon) {

	// Add the Terminal icon (static).
	const terminalIcon = document.createElement("div");
	terminalIcon.classList.add("desktop-icon");
	terminalIcon.style.position = "absolute";
	terminalIcon.style.left = "20px";
	terminalIcon.style.top = "20px";
	terminalIcon.innerHTML = `<img src="app/images/terminal.svg" alt="Terminal" style="width: 64px; height: 64px; display: block; margin: 0 auto;">
		<span style="text-align: center; display: block;">Terminal</span>`;
	terminalIcon.onclick = () => {
		import("./terminal").then((module) => {
			const terminalContent = module.createTerminalWindow();
			createWindow("Terminal", "Terminal", terminalContent);
		});
	};
	iconsContainer.appendChild(terminalIcon);

}