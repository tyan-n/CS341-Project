document.addEventListener("DOMContentLoaded", () => {
  const form       = document.getElementById("report-form");
  const allCheck   = document.getElementById("all-users");
  const emailRow   = document.getElementById("email-row");
  const emailInput = document.getElementById("user-email");
  const table      = document.getElementById("report-table");
  const tbody      = table.querySelector("tbody");

  // 1) Toggle email field visibility & requirement
  allCheck.addEventListener("change", () => {
    const hide = allCheck.checked;
    emailRow.style.display  = hide ? "none" : "block";
    emailInput.required     = !hide;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 2) Collect and validate dates
    const from = document.getElementById("from-date").value;
    const to   = document.getElementById("to-date").value;
    if (!from || !to) return alert("Please enter a valid date range.");

    // 3) Determine mode (all users vs individual)
    const isAll = allCheck.checked;
    const email = emailInput.value.trim().toLowerCase();
    if (!isAll && !email) return alert("Please enter a user email.");

    // 4) Build query parameters
    const fromDate = `${from}-01`;
    const toDate   = `${to}-31`;
    const params   = new URLSearchParams({ from: fromDate, to: toDate });
    if (!isAll) params.set("email", email);

    // 5) Fetch and render
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(
        `http://localhost:5000/api/reports/registrations?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Failed to fetch report.");

      // Clear old rows
      tbody.innerHTML = "";

      if (!data.length) {
        table.style.display = "none";
        return alert("No registrations found.");
      }

      // Populate table
      data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.FullName}</td>
          <td>${row.Email}</td>
          <td>${row.ClassName}</td>
          <td>${row.StartDate}</td>
          <td>${row.EndDate}</td>
        `;
        tbody.appendChild(tr);
      });

      table.style.display = "table";

    } catch (err) {
      console.error(err);
      alert("Server error. Could not generate report.");
    }
  });

  // …existing “Lookup Students by Class” code below remains unchanged…
  const classSearchForm = document.getElementById("class-search-form");
  const classNameInput  = document.getElementById("class-name");
  const classSelect     = document.getElementById("class-selector");
  const rosterTable     = document.getElementById("class-roster-table");
  const rosterBody      = rosterTable.querySelector("tbody");

  classSearchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name  = classNameInput.value.trim();
    const token = localStorage.getItem("token");
    if (!name) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/classes/search?name=${encodeURIComponent(name)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Class search failed.");

      classSelect.innerHTML = "";
      data.forEach(cls => {
        const option = document.createElement("option");
        option.value       = cls.ClassID;
        option.textContent = `${cls.ClassName} (${cls.StartDate} to ${cls.EndDate}) [ID: ${cls.ClassID}]`;
        classSelect.appendChild(option);
      });

      classSelect.style.display = data.length ? "block" : "none";
      if (data.length > 0) loadClassRoster(data[0].ClassID);

    } catch (err) {
      console.error(err);
      alert("Error searching for classes.");
    }
  });

  classSelect.addEventListener("change", () => {
    const classId = classSelect.value;
    if (classId) loadClassRoster(classId);
  });

  async function loadClassRoster(classId) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `http://localhost:5000/api/classes/${classId}/roster`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Failed to load roster.");

      rosterBody.innerHTML = "";
      data.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${user.FullName}</td><td>${user.Email}</td>`;
        rosterBody.appendChild(tr);
      });

      rosterTable.style.display = data.length ? "table" : "none";

    } catch (err) {
      console.error(err);
      alert("Error loading roster.");
    }
  }
});
