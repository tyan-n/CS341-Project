document.getElementById("add-program-form").addEventListener("submit", function(event) {
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

    console.log("Saving program:", programData);

    
    // 🔹 Real API Request (Uncomment when backend is ready)
    fetch("http://localhost:5000/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(programData)
    });
    

    // 🔹 Mock Storage (Temporary)
    localStorage.setItem("ymcaProgram", JSON.stringify(programData));

    document.getElementById("message").innerText = "Program added successfully!";
    setTimeout(() => {
        window.location.href = "browse.html";
    }, 2000);
});
