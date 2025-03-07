// Define a type for the createWindow function signature.
type CreateWindow = (
	title: string,
	windowTitle: string,
	content: HTMLElement,
	onClose?: () => void
) => void;

function createCalendarElement(): HTMLElement {
	// Container for the entire calendar widget.
	const container = document.createElement("div");
	container.className = "calendar-container";
	container.style.padding = "10px";
	container.style.fontFamily = "sans-serif";
  
	// --- Header Section ---
	const header = document.createElement("div");
	header.className = "calendar-header";
	header.style.display = "flex";
	header.style.justifyContent = "space-between";
	header.style.alignItems = "center";
	header.style.marginBottom = "10px";
  
	const prevButton = document.createElement("button");
	prevButton.textContent = "<";
  
	const nextButton = document.createElement("button");
	nextButton.textContent = ">";
  
	const monthYearDisplay = document.createElement("span");
	monthYearDisplay.style.fontWeight = "bold";
  
	header.appendChild(prevButton);
	header.appendChild(monthYearDisplay);
	header.appendChild(nextButton);
	container.appendChild(header);
  
	// --- Calendar Table ---
	const table = document.createElement("table");
	table.className = "calendar-table";
	table.style.width = "100%";
	table.style.borderCollapse = "collapse";
  
	// Table header for day names.
	const thead = document.createElement("thead");
	const headerRow = document.createElement("tr");
	const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	daysOfWeek.forEach(day => {
		const th = document.createElement("th");
		th.textContent = day;
		th.style.padding = "4px";
		th.style.borderBottom = "1px solid #ccc";
		headerRow.appendChild(th);
	});
	thead.appendChild(headerRow);
	table.appendChild(thead);
  
	// Table body for dates.
	const tbody = document.createElement("tbody");
	table.appendChild(tbody);
	container.appendChild(table);
  
	// --- Calendar State ---
	let currentDate = new Date();
	let currentMonth = currentDate.getMonth();
	let currentYear = currentDate.getFullYear();
  
	function renderCalendar() {
		tbody.innerHTML = "";
    
		// Update the month/year display.
		const monthNames = [
			"January", "February", "March", "April", "May", "June",
			"July", "August", "September", "October", "November", "December"
		];
		monthYearDisplay.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
		// Determine the first day of the month and number of days.
		const firstDay = new Date(currentYear, currentMonth, 1).getDay();
		const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
		let date = 1;
		// Calendar grid: maximum 6 weeks.
		for (let i = 0; i < 6; i++) {
			const row = document.createElement("tr");
      
			for (let j = 0; j < 7; j++) {
				const cell = document.createElement("td");
				cell.style.padding = "6px";
				cell.style.textAlign = "center";
				cell.style.border = "1px solid #eee";
        
				// Fill empty cells before the first day.
				if (i === 0 && j < firstDay) {
					cell.textContent = "";
				} else if (date > daysInMonth) {
					cell.textContent = "";
				} else {
					cell.textContent = date.toString();
					// Highlight today's date.
					const today = new Date();
					if (
						date === today.getDate() &&
						currentMonth === today.getMonth() &&
						currentYear === today.getFullYear()
					) {
						cell.style.backgroundColor = "#def";
						cell.style.borderRadius = "50%";
					}
					date++;
				}
				row.appendChild(cell);
			}
			tbody.appendChild(row);
			if (date > daysInMonth) break;
		}
	}
  
	// Navigation buttons.
	prevButton.addEventListener("click", () => {
		if (currentMonth === 0) {
			currentMonth = 11;
			currentYear--;
		} else {
			currentMonth--;
		}
		renderCalendar();
	});
  
	nextButton.addEventListener("click", () => {
		if (currentMonth === 11) {
			currentMonth = 0;
			currentYear++;
		} else {
			currentMonth++;
		}
		renderCalendar();
	});
  
	renderCalendar();
	return container;
}

function openCalendar(createWindow: CreateWindow) {
	const calendarElement = createCalendarElement();
	createWindow("calendar", "calendar", calendarElement);
}

export function setup(taskbar: HTMLElement, createWindow: CreateWindow) {
	const clock = document.createElement("div");
	clock.style.cursor = "pointer";
	clock.addEventListener("mouseenter", () => {
		clock.style.background = "red";
	});
	clock.addEventListener("mouseleave", () => {
		clock.style.background = "";
	});
	clock.addEventListener("click", () => {
		openCalendar(createWindow);
	});
	clock.style.marginLeft = "auto";
  
	const clockDisplay = document.createElement("span");
	clock.appendChild(clockDisplay);
  
	function updateClock() {
		clockDisplay.innerText = new Date().toLocaleTimeString();
	}
  
	setInterval(updateClock, 1000);
	updateClock();
	taskbar.appendChild(clock);
}
