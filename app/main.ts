// main.ts
import "@xterm/xterm/css/xterm.css";
import { CreateTerminal } from "./terminal";
import { setup as setupClockModule } from "./modules/clock";
import { uint8ArrayToBase64, $, createWindow, getExt, icons, vfs } from "../common";

// Create default directories.
vfs.createDirectory("/Desktop");
vfs.createDirectory("/Icons");
vfs.createDirectory("/images");
vfs.createDirectory("/Desktop/images");
vfs.createDirectory("/scripts");

// Write a sample text file on the Desktop.
vfs.writeFile("/Desktop/welcome.txt", "Welcome to Star Forge Desktop!");

// Add sample binary/icon files. The improved VirtualFS now converts remote files to data URLs.
await vfs.addFile("/Icons/terminal.svg", "app/images/terminal.svg");
await vfs.addFile("/Icons/folder-black.svg", "app/images/folder-black.svg");
await vfs.addFile("/Icons/text-x-script.svg", "app/images/text-x-script.svg");
await vfs.addFile("/Icons/image.svg", "app/images/image.svg");
await vfs.addFile("/Icons/text-richtext.svg", "app/images/text-richtext.svg");


/**
 * Creates a clickable desktop icon for a file or folder.
 * @param name - The name of the item.
 * @param path - The full VirtualFS path.
 * @param isDirectory - Whether the item is a directory.
 */
function createClickableIcon(name: string, path: string, isDirectory: boolean): HTMLElement {
	const iconEl = document.createElement("div");
	iconEl.classList.add("desktop-icon");
	iconEl.style.position = "relative";
	iconEl.style.margin = "10px";
	iconEl.style.cursor = "pointer";

	let imgSrc = "";
	if (isDirectory) {
		// A folder icon using file stored in VirtualFS.
		const folderData = vfs.readFile("/Icons/folder-black.svg");
		imgSrc = `data:image/svg+xml;base64,${uint8ArrayToBase64(folderData)}`;
	} else {
		// Use a file icon based on the file extension.
		const ext = getExt(name);
		const fileIconData = vfs.readFile(`/Icons/${icons(ext)}`);
		console.log(ext)
		imgSrc = `data:image/svg+xml;base64,${uint8ArrayToBase64(fileIconData)}`;
	}
	console.log(imgSrc)

	iconEl.innerHTML = `
    <img src="${imgSrc}" alt="${name}" style="width: 64px; height: 64px; display: block; margin: 0 auto;">
    <span style="display: block; text-align: center;">${name}</span>
  `;

	iconEl.onclick = () => {
		if (isDirectory) {
			openFolderWindow(name, path);
		} else {
			const contentUint8 = vfs.readFile(path);
			if (contentUint8) {
				const metadata = vfs.getMetadata(path);
				if (metadata && metadata.fileType) {
					// Render text files
					if (metadata.fileType.startsWith("text/")) {
						const content = new TextDecoder().decode(contentUint8);
						const contentDiv = document.createElement("div");
						contentDiv.innerText = content;
						createWindow(name, name, contentDiv);
					}
					// Render image files
					else if (metadata.fileType.startsWith("image/")) {
						const blob = new Blob([contentUint8], { type: metadata.fileType });
						const url = URL.createObjectURL(blob);
						const imgElm = document.createElement("img");
						imgElm.src = url;
						imgElm.style.maxWidth = "100%";
						imgElm.style.maxHeight = "100%";
						createWindow(name, name, imgElm);
					}
					// Fallback to text
					else {
						const content = new TextDecoder().decode(contentUint8);
						const contentDiv = document.createElement("div");
						contentDiv.innerText = content;
						createWindow(name, name, contentDiv);
					}
				}
			}
		}
	};

	return iconEl;
}
/**
 * Opens a folder in a new window. Lists its contents (files and directories) as clickable icons.
 * @param folderName - The display name of the folder.
 * @param folderPath - The full VirtualFS path of the folder.
 */
function openFolderWindow(folderName: string, folderPath: string) {
	const items = vfs.listDirectory(folderPath);
	if (!items) {
		alert("Folder not found");
		return;
	}

	// Outer container for the folder explorer window.
	const explorerContainer = document.createElement("div");
	explorerContainer.style.display = "flex";
	explorerContainer.style.flexDirection = "column";
	explorerContainer.style.height = "100%";

	// Create header with folder name and controls.
	const header = document.createElement("div");
	header.style.display = "flex";
	header.style.justifyContent = "space-between";
	header.style.alignItems = "center";
	header.style.padding = "5px";
	header.style.borderBottom = "1px solid #ccc";

	const titleLabel = document.createElement("span");
	titleLabel.innerText = folderName;
	titleLabel.style.fontWeight = "bold";
	header.appendChild(titleLabel);

	const controls = document.createElement("div");

	// New Folder Button.
	const newFolderBtn = document.createElement("button");
	newFolderBtn.innerText = "New Folder";
	newFolderBtn.onclick = () => {
		const newFolderName = prompt("Enter new folder name:");
		if (newFolderName) {
			const success = vfs.createDirectory(`${folderPath}/${newFolderName}`);
			if (!success) alert("Folder already exists or invalid name.");
			else renderFolderContents();
		}
	};
	controls.appendChild(newFolderBtn);

	// New File Button.
	const newFileBtn = document.createElement("button");
	newFileBtn.innerText = "New File";
	newFileBtn.style.marginLeft = "5px";
	newFileBtn.onclick = () => {
		const newFileName = prompt("Enter new file name:");
		if (newFileName) {
			const success = vfs.writeFile(`${folderPath}/${newFileName}`, "");
			if (!success) alert("File already exists or invalid name.");
			else renderFolderContents();
		}
	};
	controls.appendChild(newFileBtn);

	// Refresh Button.
	const refreshBtn = document.createElement("button");
	refreshBtn.innerText = "Refresh";
	refreshBtn.style.marginLeft = "5px";
	refreshBtn.onclick = renderFolderContents;
	controls.appendChild(refreshBtn);

	header.appendChild(controls);
	explorerContainer.appendChild(header);

	// Container for folder content icons.
	const contentHolder = document.createElement("div");
	contentHolder.classList.add("folder-explorer");
	contentHolder.style.display = "flex";
	contentHolder.style.flexWrap = "wrap";
	contentHolder.style.gap = "10px";
	contentHolder.style.padding = "10px";
	contentHolder.style.overflowY = "auto";
	contentHolder.style.flexGrow = "1";
	explorerContainer.appendChild(contentHolder);

	// Re-render folder contents.
	function renderFolderContents() {
		contentHolder.innerHTML = "";
		const names = vfs.listDirectory(folderPath);
		if (names) {
			names.forEach((itemName) => {
				const itemPath = `${folderPath}/${itemName}`;
				const metadata = vfs.getMetadata(itemPath);
				// Treat item as a file if metadata has fileType; else a directory.
				const isDirectory = !(metadata && metadata.fileType);
				const icon = createClickableIcon(itemName, itemPath, isDirectory);
				contentHolder.appendChild(icon);
			});
		}
	}
	renderFolderContents();
	createWindow(folderName, folderName, explorerContainer);
}

/**
 * Renders all icons stored under the "/Desktop" directory in VirtualFS.
 */
function renderDesktopIcons() {
	const desktopEl = $("desktop");
	desktopEl.innerHTML = ""; // Clear any previous icons
	const items = vfs.listDirectory("/Desktop");
	if (items) {
		items.forEach((itemName) => {
			const itemPath = `/Desktop/${itemName}`;
			const metadata = vfs.getMetadata(itemPath);
			// If metadata.fileType exists then it is a file; otherwise a folder.
			const isDirectory = !(metadata && metadata.fileType);
			const icon = createClickableIcon(itemName, itemPath, isDirectory);
			desktopEl.appendChild(icon);
		});
	}
}

/**
 * Set up the start menu on the taskbar.
 * @param taskbar - The taskbar element.
 * @param createWindowFn - The createWindow function.
 */
export function setupStartMenu(
	taskbar: HTMLElement,
	createWindowFn: (
		title: string,
		windowTitle: string,
		content: HTMLElement,
		onClose?: () => void
	) => void
): HTMLElement {
	const menu = $("applications");
	const openBTN = document.createElement("button");
	openBTN.innerText = "start";
	openBTN.style.position = "absolute";
	openBTN.style.left = "0";
	menu.style.position = "absolute";
	menu.style.width = "400px";
	menu.style.bottom = "40px";
	menu.style.left = "6px";
	menu.style.background = "rgb(20,20,20)";
	menu.style.border = "ridge rgb(120,120,120) 2px";
	menu.style.display = "none";
	menu.style.height = "0";

	const targetHeight = "400px";
	openBTN.onclick = () => {
		if (menu.style.height === targetHeight) {
			menu.style.height = "0";
			setTimeout(() => {
				menu.style.display = "none";
			}, 200);
		} else {
			menu.style.display = "block";
			setTimeout(() => {
				menu.style.height = targetHeight;
			}, 10);
		}
	};
	taskbar.appendChild(openBTN);
	window.addEventListener("click", (e) => {
		if (e.target != menu && menu.style.height === targetHeight) {
			menu.style.height = "0";
			setTimeout(() => {
				menu.style.display = "none";
			}, 200);
		
		}
	})
	return menu;
}

/**
 * Asynchronously initialize the VirtualFS, default directories, files, and desktop icons.
 */

// --- Taskbar Setup ---
const taskbar = $("taskbar");
setupClockModule(taskbar, createWindow);
const startMenu = setupStartMenu(taskbar, createWindow);

// Create additional icons (e.g. terminal).
const iconsToCreate = [CreateTerminal];
iconsToCreate.forEach((createApp) => createApp(startMenu, createWindow, vfs));

// Render desktop icons.
renderDesktopIcons();
