document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html?redirect=my-classes.html";
    return;
  }

  const noClassesMsg = document.getElementById("no-classes-message");
  const calendarGrid = document.getElementById("calendar-grid");
  const currentWeekRangeSpan = document.getElementById("current-week-range");
  const prevWeekBtn = document.getElementById("prev-week");
  const nextWeekBtn = document.getElementById("next-week");

  // Render the time column on the left
  function renderTimeColumn() {
    const timeColumn = document.getElementById("time-column");
    timeColumn.innerHTML = ""; // Clear previous labels if any
    // Assume grid starts at 7:00 AM and runs to 10:00 PM.
    for (let hour = 7; hour <= 22; hour++) {
      const label = document.createElement("div");
      label.className = "time-label";
      // Format the time label (7 AM, 8 AM, ..., 12 PM, 1 PM, etc.)
      label.textContent = hour <= 12 ? hour + " AM" : (hour === 12 ? "12 PM" : (hour - 12) + " PM");
      // Calculate the top offset: grid starts at 7:00, so (hour*60 - (7*60)) gives pixels from 0.
      const topPx = (hour * 60) - (7 * 60);
      label.style.top = topPx + "px";
      timeColumn.appendChild(label);
    }
  }

  // Get Sunday as the start of the week.
  function getWeekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Format a date range (e.g., "Sun, Mar 28 - Sat, Apr 03")
  function formatWeekRange(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }

  // Global variable for the currently viewed week start date.
  let currentWeekStart = getWeekStart(new Date());

  // Define a function to render the weekly calendar grid (day columns).
  function renderCalendarGrid(weekStart) {
    calendarGrid.innerHTML = "";
    // Create 7 day columns for Sunday through Saturday.
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const dayCol = document.createElement("div");
      dayCol.className = "day-column";
      dayCol.setAttribute("data-date", dayDate.toISOString().split('T')[0]); // e.g. "2025-04-07"
      const header = document.createElement("h3");
      header.textContent = dayDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      dayCol.appendChild(header);
      calendarGrid.appendChild(dayCol);
    }
    currentWeekRangeSpan.textContent = formatWeekRange(weekStart);
  }

  // Render initial time column and grid.
  renderTimeColumn();
  renderCalendarGrid(currentWeekStart);

  // Event listeners for navigation buttons.
  prevWeekBtn.addEventListener("click", () => {
    // Only allow navigating to weeks that are after or equal to the current week.
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    const thisWeekStart = getWeekStart(new Date());
    if (newWeekStart < thisWeekStart) return; // prevent navigating before current week
    currentWeekStart = newWeekStart;
    renderCalendarGrid(currentWeekStart);
    renderClasses();
  });

  nextWeekBtn.addEventListener("click", () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    currentWeekStart = newWeekStart;
    renderCalendarGrid(currentWeekStart);
    renderClasses();
  });

  // Fetch user registrations.
  let registrations = [];
  try {
    const res = await fetch("http://localhost:5000/api/registrations", {
      headers: { Authorization: `Bearer ${token}` }
    });
    registrations = await res.json();
    if (!Array.isArray(registrations) || registrations.length === 0) {
      noClassesMsg.textContent = "You are not registered for any classes.";
      return;
    }
  } catch (err) {
    console.error("Fetch error:", err);
    noClassesMsg.textContent = "Error loading your classes.";
    return;
  }

  // Helper: Given a base date (YYYY-MM-DD) and a week offset, return the occurrence date.
  function getOccurrenceDate(baseDateStr, weekOffset) {
    const d = new Date(baseDateStr);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }

  // Expand registrations into occurrences based on Frequency.
  function expandRegistrations(registrations) {
    const expanded = [];
    registrations.forEach(reg => {
      const freq = parseInt(reg.Frequency) || 1;
      for (let i = 0; i < freq; i++) {
        const occurrence = { ...reg };
        const occDate = getOccurrenceDate(reg.startDate, i);
        occurrence.occurrenceDate = occDate.toISOString().split('T')[0];
        expanded.push(occurrence);
      }
    });
    return expanded;
  }

  const expandedRegistrations = expandRegistrations(registrations);

  // Render class occurrences for the currently displayed week.
  function renderClasses() {
    // Clear previous class entries from each day column.
    const dayCols = document.querySelectorAll(".day-column");
    dayCols.forEach(col => {
      while (col.childNodes.length > 1) {
        col.removeChild(col.lastChild);
      }
    });

    // Iterate over each occurrence and render it if within the current week.
    expandedRegistrations.forEach(reg => {
      const occDate = new Date(reg.occurrenceDate);
      const occISO = occDate.toISOString().split('T')[0];
      // Only render if occDate falls between currentWeekStart and currentWeekStart+6 days.
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (occDate < currentWeekStart || occDate > weekEnd) return;

      const dayCol = document.querySelector(`.day-column[data-date="${occISO}"]`);
      if (!dayCol) return;

      // Calculate vertical offset: convert startTime to minutes from midnight.
      const [startH, startM] = reg.startTime.split(":").map(Number);
      const offsetMinutes = startH * 60 + startM;
      // Adjust offset: grid starts at 7 AM.
      const topPx = offsetMinutes - (7 * 60);
      // Calculate the height based on duration.
      const [endH, endM] = reg.endTime.split(":").map(Number);
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      const heightPx = durationMinutes;

      const entry = document.createElement("div");
      entry.className = "class-entry";
      entry.style.top = topPx + "px";
      entry.style.height = heightPx + "px";

      // Format occurrence date for display.
      const formattedDate = occDate.toLocaleDateString();

      entry.innerHTML = `
        <strong>${reg.name}</strong><br>
        ${reg.startTime} – ${reg.endTime}<br>
        ${formattedDate}<br>
        Class Number: ${reg.id}<br>
        <em>${reg.location}</em><br>
        <button class="unregister-btn" data-id="${reg.id}" data-occurrence="${occISO}">Unregister</button>
      `;

      entry.querySelector(".unregister-btn").addEventListener("click", async function () {
        if (!confirm("Are you sure you want to unregister from this class occurrence?")) return;
        try {
          const deleteRes = await fetch(`http://localhost:5000/api/registrations/${reg.id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            }
          });
          if (deleteRes.ok) {
            entry.remove();
          } else {
            alert("Failed to unregister.");
          }
        } catch (err) {
          console.error("Unregister error:", err);
          alert("Error unregistering from class.");
        }
      });

      dayCol.appendChild(entry);
    });
  }

  // Finally, render the classes.
  renderClasses();
});
