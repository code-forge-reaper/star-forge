// /common.ts
import { VirtualFS } from "./app/filesystem";

// Initialize the in-memory filesystem instance.
export const vfs = new VirtualFS();
/**
 * Resolves the given input path relative to the current working directory.
 * If the input path is absolute, it is returned directly.
 */
export function resolvePath(current: string, inputPath: string): string {
	if (inputPath.startsWith("/")) return inputPath;
	if (current === "/") {
		return "/" + inputPath;
	} else {
		return `${current}/${inputPath}`;
	}
}

/**
 * Resolves and returns the parent directory of the current directory.
 */
export function getParentDirectory(path: string): string {
	const parts = path.split("/").filter((p) => p.length > 0);
	parts.pop(); // Remove the last directory
	return parts.length === 0 ? "/" : "/" + parts.join("/");
}


/**
 * Helper: Converts a Uint8Array (if available) into a base64 string.
 * @param uint8Array - The Uint8Array to convert.
 * @returns A base64 encoded string.
 */
export function uint8ArrayToBase64(uint8Array: Uint8Array | null): string {
	if (!uint8Array) return "";
	let binary = "";
	for (let i = 0; i < uint8Array.length; i++) {
		binary += String.fromCharCode(uint8Array[i]);
	}
	return btoa(binary);
}

/**
 * Utility function to select an element by its ID.
 * @param id - The ID of the element.
 */
export function $(id: string): HTMLElement {
	const el = document.getElementById(id);
	if (!el) {
		throw new Error(`Element with id "${id}" not found`);
	}
	return el;
}

/**
 * Returns an icon filename based on file extension.
 * @param ext - The file extension.
 */
export const icons = (ext: string): string => {
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

/**
 * Extract the file extension.
 * @param filename - The name (with extension) of the file.
 */
export const getExt = (filename: string): string => {
	const parts = filename.split(".");
	return parts[parts.length - 1].toLowerCase();
};

/**
 * Global window management counters.
 */
let zIndexCounter = 1;
let windowCounter = 0;

/**
 * Creates a desktop window that can be moved around.
 * @param title - The title for the window (used also as an identifier).
 * @param windowTitle - The title shown on the window header.
 * @param content - The HTMLElement to display inside the window.
 * @param onClose - Optional callback that is executed once the window is closed.
 */
export function createWindow(
	title: string,
	windowTitle: string,
	content: HTMLElement,
	onClose?: () => void
) {
	const windowEl = document.createElement("div");
	windowEl.classList.add("window");
	windowEl.style.left = "100px";
	windowEl.style.top = "100px";
	windowEl.style.zIndex = `${++zIndexCounter}`;
	windowEl.id = `window-${windowCounter++}`;

	// --- Create Window Header ---
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
		if (onClose) onClose();
	};

	controls.appendChild(closeBtn);
	header.append(titleEl, controls);
	windowEl.appendChild(header);

	// --- Create Window Body ---
	const bodyContainer = document.createElement("div");
	bodyContainer.classList.add("window-body");
	bodyContainer.appendChild(content);
	windowEl.appendChild(bodyContainer);
	$("desktop").appendChild(windowEl);

	// --- Make the Window Draggable ---
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
