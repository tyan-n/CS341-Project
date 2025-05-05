document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("report-form");
    const table = document.getElementById("report-table");
    const tbody = table.querySelector("tbody");
  
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
      
        const from = document.getElementById("from-date").value;
        const to = document.getElementById("to-date").value;
        const email = document.getElementById("user-email").value.trim().toLowerCase();
        if (!email) return alert("Please enter a user email.");
                const token = localStorage.getItem("token");
        if (!from || !to) return alert("Please enter a valid date range.");
      
        const fromDate = `${from}-01`;
        const toDate = `${to}-31`;

        const query = new URLSearchParams({
            from: fromDate,
            to: toDate,
            email: email
          });      
      
          try {
            const res = await fetch(`http://localhost:5000/api/reports/registrations?${query}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
          
            const data = await res.json();
            if (!res.ok) return alert(data.error || "Failed to fetch report.");
          
            // Clear old rows
            tbody.innerHTML = "";
          
            if (!data || data.length === 0) {
              table.style.display = "none";
              alert("No registrations found for that user and date range.");
              return;
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
      
      const classSearchForm = document.getElementById("class-search-form");
        const classNameInput = document.getElementById("class-name");
        const classSelect = document.getElementById("class-selector");
        const rosterTable = document.getElementById("class-roster-table");
        const rosterBody = rosterTable.querySelector("tbody");

        // Step 1: Search classes by name
        classSearchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = classNameInput.value.trim();
        const token = localStorage.getItem("token");
        if (!name) return;

        try {
            const res = await fetch(`http://localhost:5000/api/classes/search?name=${encodeURIComponent(name)}`, {
            headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();
            if (!res.ok) return alert(data.error || "Class search failed.");

            classSelect.innerHTML = "";
            data.forEach(cls => {
            const option = document.createElement("option");
            option.value = cls.ClassID;
            option.textContent = `${cls.ClassName} (${cls.StartDate} to ${cls.EndDate}) [ID: ${cls.ClassID}]`;
            classSelect.appendChild(option);
            });

            classSelect.style.display = data.length ? "block" : "none";
            if (data.length > 0) loadClassRoster(data[0].ClassID); // auto-load first
        } catch (err) {
            console.error(err);
            alert("Error searching for classes.");
        }
        });

        // Step 2: Load users for selected class
        classSelect.addEventListener("change", () => {
            const classId = classSelect.value;
            if (classId) loadClassRoster(classId);
        });

        async function loadClassRoster(classId) {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`http://localhost:5000/api/classes/${classId}/roster`, {
            headers: { Authorization: `Bearer ${token}` }
            });

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
  