document.getElementById("add-program-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    const programData = {
        name: document.getElementById("name").value,
        startDate: document.getElementById("start-date").value,
        endDate: document.getElementById("end-date").value,
        startTime: document.getElementById("start-time").value,
        endTime: document.getElementById("end-time").value,
        location: document.getElementById("location").value,
        description: document.getElementById("description").value,
        capacity: document.getElementById("capacity").value,
        priceMember: parseFloat(document.getElementById("price-member").value),
        priceNonMember: parseFloat(document.getElementById("price-nonmember").value)
    };

    try {
        const response = await fetch("http://localhost:5000/api/programs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(programData)
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById("message").innerText = "Program added successfully!";
            setTimeout(() => {
                window.location.href = "browse.html";
            }, 2000);
        } else {
            document.getElementById("message").innerText = `Error: ${data.error}`;
        }
    } catch (error) {
        console.error("Error adding program:", error);
        document.getElementById("message").innerText = "Error connecting to server.";
    }
});
