// main.ts
import "./style.css";
import {
	FS,
	cDir,
	getFSObject,
	GetType,
	resolvePath,
	subscribeToFSChanges,
	unsubscribeFromFSChanges,
	notifyFSChange
	// Assume that notifyFSChange and createFile exist in the filesystem module.
} from "./filesystem";
import { CreateTerminal } from "./terminal";

const iconsToCreate = [
	CreateTerminal
]

// Utility function to select an element by its ID.
function $(id: string): HTMLElement {
	return document.getElementById(id)!;
}

// Returns an image filename based on file extension.
const icons = (ext: string): string => {
	switch (ext) {
		case "lua":
		case "flux":
			return "text-x-script.svg";
		case "jpg":
		case "jpeg":
		case "png":
		case "gif":
			return "image.svg";
		default:
			return "text-richtext.svg";
	}
};

// Determine file extension from a given file name.
const getExt = (filename: string): string => {
	const parts = filename.split(".");
	return parts[parts.length - 1];
};

// Helper to detect if an item is a directory/folder.
const isDirectory = (item: any): boolean => {
	return typeof item === "object";
};

let zIndexCounter = 1;
let windowCounter = 0;

/**
 * Create a window on the desktop.
 * Accepts an optional onClose callback that is executed when the window is closed.
 */
function createWindow(title: string, windowTitle: string, content: HTMLElement, onClose?: () => void) {
	const windowEl = document.createElement("div");
	windowEl.classList.add("window");
	windowEl.style.left = "100px";
	windowEl.style.top = "100px";
	windowEl.style.zIndex = `${++zIndexCounter}`;
	windowEl.id = `window-${windowCounter++}`;

	// Create window header.
	const header = document.createElement("div");
	header.classList.add("window-header");

	const titleEl = document.createElement("div");
	titleEl.classList.add("window-title");
	titleEl.innerText = windowTitle;

	const controls = document.createElement("div");
	controls.classList.add("window-controls");

	const closeBtn = document.createElement("button");
	closeBtn.innerText = "✖";
	closeBtn.onclick = () => {
		windowEl.remove();
		// Execute extra cleanup if provided.
		if (onClose) onClose();
	};

	controls.appendChild(closeBtn);
	header.appendChild(titleEl);
	header.appendChild(controls);
	windowEl.appendChild(header);

	// Window body.
	const bodyContainer = document.createElement("div");
	bodyContainer.classList.add("window-body");
	bodyContainer.appendChild(content);
	windowEl.appendChild(bodyContainer);

	$("desktop").appendChild(windowEl);

	// Window dragging mechanism.
	header.addEventListener("mousedown", (e) => {
		const offsetX = e.clientX - windowEl.offsetLeft;
		const offsetY = e.clientY - windowEl.offsetTop;
		windowEl.style.zIndex = `${++zIndexCounter}`;

		const onMouseMove = (e: MouseEvent) => {
			windowEl.style.left = `${e.clientX - offsetX}px`;
			windowEl.style.top = `${e.clientY - offsetY}px`;
		};

		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	});
}

// -----------------------------
// File Explorer (Folder Window) with FS Change Subscription and Creation Controls
function openFolderWindow(folderName: string, folderObj: any, currentPath: string) {
	// Outer container for the explorer window.
	const explorerContainer = document.createElement("div");
	explorerContainer.style.display = "flex";
	explorerContainer.style.flexDirection = "column";
	explorerContainer.style.height = "100%";

	// Header: label and controls.
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
		const folderName = prompt("Enter new folder name:");
		if (folderName && !(folderName in folderObj)) {
			folderObj[folderName] = {};
			// Optionally, if you have a createFile or mkdir shortcut, call it here.
			// createFolder(currentPath, folderName);
			notifyFSChange();
		} else {
			alert("Folder already exists or invalid name.");
		}
	};
	controls.appendChild(newFolderBtn);

	// New File Button.
	const newFileBtn = document.createElement("button");
	newFileBtn.innerText = "New File";
	newFileBtn.style.marginLeft = "5px";
	newFileBtn.onclick = () => {
		const fileName = prompt("Enter new file name:");
		if (fileName && !(fileName in folderObj)) {
			// Create an empty file.
			folderObj[fileName] = "";
			// Optionally, if you have a dedicated createFile function, you can use it.
			// createFile(currentPath + "/" + fileName, "");
			notifyFSChange();
		} else {
			alert("File already exists or invalid name.");
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

	// Container holding the folder content icons.
	const contentHolder = document.createElement("div");
	contentHolder.classList.add("folder-explorer");
	// Use flex layout with wrapping for the icons:
	contentHolder.style.display = "flex";
	contentHolder.style.flexWrap = "wrap";
	contentHolder.style.gap = "10px";
	contentHolder.style.padding = "10px";
	contentHolder.style.overflowY = "auto";
	// Allow explorer content to flex (grow/shrink).
	contentHolder.style.flexGrow = "1";

	explorerContainer.appendChild(contentHolder);

	/**
	 * Render the icons inside the explorer (for files and folders)
	 */
	function renderFolderContents() {
		// Clear current icons.
		contentHolder.innerHTML = "";
		for (const itemName in folderObj) {
			const newPath = `${currentPath}/${itemName}`;
			const item = folderObj[itemName];
			const iconEl = createClickableIcon(itemName, item, newPath);
			contentHolder.appendChild(iconEl);
		}
	}

	// Initial render.
	renderFolderContents();

	// Subscribe to FS changes so that the explorer can update its display.
	const fsChangeCallback = () => {
		renderFolderContents();
	};
	subscribeToFSChanges(fsChangeCallback);

	// When the window is closed, unsubscribe from FS changes.
	function cleanup() {
		unsubscribeFromFSChanges(fsChangeCallback);
	}

	createWindow(folderName, folderName, explorerContainer, cleanup);
}
function getNode(a, b) {
	let fd = b; // Start at the root of the structure
	for (const key of a) {
		if (fd[key] !== undefined) {
			fd = fd[key]; // Move deeper into the structure
		} else {
			return undefined; // If the key does not exist, return undefined
		}
	}
	return fd; // Return the final node found
}

// -----------------------------
// Create a clickable icon element for a file or folder.
function createClickableIcon(name: string, item: any, fullPath: string): HTMLElement {
	const icon = document.createElement("div");
	icon.classList.add("desktop-icon");
	icon.style.position = "relative";
	icon.style.margin = "10px";
	icon.style.cursor = "pointer";
	let imgSrc = "";
	let label = name;

	if (isDirectory(item)) {
		// Folder icon.
		imgSrc = "app/images/folder-black.svg";
	} else {
		// File icon based on extension.
		const ext = getExt(name).toLowerCase();
		imgSrc = `app/images/${icons(ext)}`;
	}

	icon.innerHTML = `<img src="${imgSrc}" alt="${name}" style="width: 64px; height: 64px; display: block; margin: 0 auto;">
		<span style="display: block; text-align: center;">${label}</span>`;

	// Handle click.
	icon.onclick = () => {
		if (isDirectory(item)) {
			// Open a new file explorer window.
			openFolderWindow(name, item, fullPath);
		} else {
			// Handle files.
			const ext = getExt(name).toLowerCase();
			const fileContent = item;

			if (["txt", "md", "dcx", "lua", "flux"].includes(ext)) {
				// Create editable text file window.
				const container = document.createElement("div");
				container.style.display = "flex";
				container.style.flexDirection = "column";
				container.style.height = "100%";

				const editor = document.createElement("textarea");
				editor.value = fileContent;
				editor.style.flexGrow = "1";
				editor.style.width = "100%";

				const saveBtn = document.createElement("button");
				saveBtn.innerText = "Save";
				saveBtn.style.marginTop = "5px";
				saveBtn.onclick = () => {
					const resolvedPath = resolvePath(fullPath, cDir)
					const parentPath = resolvedPath.slice(0, resolvedPath.length - 1);
					const fileName = resolvedPath[resolvedPath.length - 1];
					const parent = getFSObject(parentPath);
					console.log(parentPath, fileName, parent)
					parent[fileName] = editor.value
					console.log(`Saved ${fullPath}`);
					notifyFSChange();
				};

				container.appendChild(editor);
				container.appendChild(saveBtn);
				createWindow(name, name, container);
			} else if (["mp4", "webm", "ogg", "gif"].includes(ext)) {
				const video = document.createElement("video");
				video.controls = true;
				video.src = fileContent;
				video.style.width = "100%";
				video.style.height = "100%";
				createWindow(name, name, video);
			} else if (["jpg", "jpeg", "png"].includes(ext)) {
				const img = document.createElement("img");
				img.src = fileContent;
				img.style.maxWidth = "100%";
				img.style.maxHeight = "100%";
				createWindow(name, name, img);
			} else {
				const content = document.createElement("div");
				content.innerText = fileContent;
				createWindow(name, name, content);
			}
		}
	};

	return icon;
}

// ----------------------------------------------------------------------
// Taskbar Setup
const taskbar = $("taskbar");
const startBtn = document.createElement("button");
startBtn.innerText = "Start";
startBtn.onclick = () => {
	console.log("Start menu clicked");
};
taskbar.appendChild(startBtn);

const clock = document.createElement("div");
clock.style.marginLeft = "auto";
function updateClock() {
	clock.innerText = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();
taskbar.appendChild(clock);

// ----------------------------------------------------------------------
// Desktop Icons Rendering with New Columns Logic.
function createDesktopIcons() {
	// Create or select a container for desktop icons.
	let iconsContainer = document.getElementById("desktop-icons");
	if (!iconsContainer) {
		iconsContainer = document.createElement("div");
		iconsContainer.id = "desktop-icons";
		iconsContainer.style.position = "absolute";
		iconsContainer.style.top = "0";
		iconsContainer.style.left = "0";
		$("desktop").appendChild(iconsContainer);
	}
	// Clear any existing icons.
	iconsContainer.innerHTML = "";
	iconsToCreate.forEach(e => e(iconsContainer, createWindow, createClickableIcon))
	// Render FS Desktop folder entries.
	const desktopFS = FS["/"].Desktop;
	// Starting positions.
	let offsetX = 20; // initial horizontal offset.
	let offsetY = 100; // initial vertical offset.
	const spacingY = 100; // vertical spacing between icons.
	const spacingX = 100; // horizontal spacing between columns.

	// Get the height of the desktop container to constrain vertical positioning.
	const desktopHeight = $("desktop").clientHeight || window.innerHeight;

	// Iterate over each item on the Desktop.
	for (const name in desktopFS) {
		// Create the icon for each file or folder.
		const iconElement = createClickableIcon(name, desktopFS[name], `/Desktop/${name}`);
		// Position each icon absolutely.
		iconElement.style.position = "absolute";
		iconElement.style.left = `${offsetX}px`;
		iconElement.style.top = `${offsetY}px`;
		iconsContainer.appendChild(iconElement);

		// Move down for the next icon.
		offsetY += spacingY;

		// When the next icon would overflow the desktop height, reset vertical offset and move horizontally.
		if (offsetY + spacingY > desktopHeight) {
			offsetY = 100; // reset vertical offset.
			offsetX += spacingX;
		}
	}
}

// Initial render of desktop icons.
createDesktopIcons();

// Subscribe to filesystem changes to re‑draw the desktop.
subscribeToFSChanges(() => {
	createDesktopIcons();
});
