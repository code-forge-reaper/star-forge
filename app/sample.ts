const searchD = "https://duckduckgo.com/html/?q=%search%"

export function CreateBrowser(iconsContainer: { appendChild: (arg0: HTMLDivElement) => void; }, createWindow: (arg0: string, arg1: string, arg2: HTMLDivElement) => void, createClickableIcon: (name: string, item: any, fullPath: string) => HTMLElement) {

	// Add the Terminal icon (static).
	const browserIcon = document.createElement("div");
	browserIcon.classList.add("desktop-icon");
	browserIcon.style.position = "absolute";
	browserIcon.style.left = "120px";
	browserIcon.style.top = "20px";
	browserIcon.innerHTML = `<img src="app/images/terminal.svg" alt="Terminal" style="width: 64px; height: 64px; display: block; margin: 0 auto;">
		<span style="text-align: center; display: block;">Terminal</span>`;
	browserIcon.onclick = () => {
		const frame = document.createElement("div")
		const body = document.createElement("div")
		body.innerHTML = "this is a example applet"
		frame.appendChild(body)

		createWindow("Terminal", "Terminal", frame);
	};
	iconsContainer.appendChild(browserIcon);
}
