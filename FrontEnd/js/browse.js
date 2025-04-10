document.addEventListener("DOMContentLoaded", async function () {
    const programList = document.getElementById("program-list");
    const role = localStorage.getItem("role");

    try {
        const response = await fetch("http://localhost:5000/api/programs");
        const programs = await response.json();

        // Filter out inactive classes
        const activePrograms = programs.filter(p => p.status !== "Inactive");

        if (activePrograms.length > 0) {
            programList.innerHTML = activePrograms.map(program => {
                let buttonsHTML = `<button class="register-btn ymca-button" data-id="${program.id}">Register</button>`;
                if (role === "staff") {
                    buttonsHTML += `<button class="delete-btn ymca-button" data-id="${program.id}">Delete Class</button>`;
                }

                return `
                    <div class="program-card">
                        <h3>${program.name}</h3>
                        <p><strong>Description:</strong> ${program.description}</p>
                        <p><strong>Date:</strong> ${program.startDate} to ${program.endDate}</p>
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

    // Register and delete button listeners
    document.addEventListener("click", function (e) {
        if (e.target.classList.contains("register-btn")) {
            const programId = e.target.getAttribute("data-id");
            window.location.href = `register.html?programId=${programId}`;
        }

        if (e.target.classList.contains("delete-btn")) {
            const programId = e.target.getAttribute("data-id");
            const token = localStorage.getItem("token");

            if (!token) {
                alert("Please log in to delete a class.");
                return;
            }

            if (!confirm("Are you sure you want to delete this class?")) return;

            fetch(`http://localhost:5000/api/programs/${programId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.message) {
                        alert("Class deleted successfully!");
                        window.location.reload();
                    } else {
                        alert(`Error: ${data.error}`);
                    }
                })
                .catch(err => {
                    console.error("Error deleting class:", err);
                    alert("Server error.");
                });
        }
    });
});
