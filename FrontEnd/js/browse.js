document.addEventListener("DOMContentLoaded", async function() {
    const programList = document.getElementById("program-list");
    // Get user role from localStorage (set during login)
    const role = localStorage.getItem("role");

    try {
        const response = await fetch("http://localhost:5000/api/programs"); // Fetch programs from backend
        const programs = await response.json();

        if (programs.length > 0) {
            programList.innerHTML = programs.map(program => {
                // Always include a Register button
                let buttonsHTML = `
                    <button class="register-btn ymca-button" data-id="${program.id}">Register</button>
                `;
                // If the user is staff, add an additional Delete button
                if (role === "staff") {
                    buttonsHTML += `
                        <button class="delete-btn ymca-button" data-id="${program.id}">Delete Class</button>
                    `;
                }
                return `
                    <div class="program-card">
                        <h3>${program.name}</h3>
                        <p><strong>Description:</strong> ${program.description}</p>
                        <p><strong>Time:</strong> ${program.startTime} - ${program.endTime}</p>
                        <p><strong>Location:</strong> ${program.location}</p>
                        <p><strong>Price:</strong> $${program.priceMember} (Member) / $${program.priceNonMember} (Non-Member)</p>
                        <p><strong>Capacity:</strong> ${program.capacity}</p>
                        ${buttonsHTML}
                    </div>
                `;
            }).join("");
        } else {
            programList.innerHTML = "<p>No programs available.</p>";
        }
    } catch (error) {
        console.error("Error fetching programs:", error);
        programList.innerHTML = "<p>Error loading programs.</p>";
    }

    // Register button event listener (for all users)
    document.querySelectorAll(".register-btn").forEach(button => {
        button.addEventListener("click", function() {
            const programId = this.getAttribute("data-id");
            window.location.href = `register.html?programId=${programId}`;
        });
    });

    // Delete button event listener (only visible to staff)
    document.querySelectorAll(".delete-btn").forEach(button => {
        button.addEventListener("click", async function() {
            const programId = this.getAttribute("data-id");
            // Check token exists before deleting
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Please log in to delete a class.");
                return;
            }
            console.log("Using token for deletion:", token);  // Debug log

            if (!confirm("Are you sure you want to delete this class?")) return;
            try {
                const response = await fetch(`http://localhost:5000/api/programs/${programId}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await response.json();
                if (response.ok) {
                    alert("Class deleted successfully!");
                    window.location.reload();
                } else {
                    alert(`Error: ${data.error}`);
                }
            } catch (error) {
                console.error("Error deleting class:", error);
                alert("Error connecting to server.");
            }
        });
    });
});
