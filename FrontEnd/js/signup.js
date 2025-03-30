document.getElementById("signup-form").addEventListener("submit", async function (event) {
  event.preventDefault();

  const payload = {
    username: document.getElementById("signup-username").value,
    password: document.getElementById("signup-password").value,
    fname: document.getElementById("fname").value,
    mname: document.getElementById("mname").value,
    lname: document.getElementById("lname").value,
    birthday: document.getElementById("birthday").value,
    street: document.getElementById("street").value,
    houseNumber: document.getElementById("house-number").value,
    city: document.getElementById("city").value,
    state: document.getElementById("state").value,
    zipCode: document.getElementById("zip-code").value,
    phone: document.getElementById("phone").value,
    membershipType: document.getElementById("membership-type").value
  };

  try {
    const response = await fetch("http://localhost:5000/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById("signup-message").innerText = "Account created! Redirecting...";
      setTimeout(() => window.location.href = "login.html", 2000);
    } else {
      document.getElementById("signup-message").innerText = data.error || "Signup failed.";
    }
  } catch (error) {
    console.error("Signup failed:", error);
    document.getElementById("signup-message").innerText = "Error connecting to server.";
  }
});
