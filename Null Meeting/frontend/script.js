const API_URL = "https://null-meeting.onrender.com";

async function registerUser() {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!name || !email || !password) {
        alert("Please fill all fields");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        console.log("Register response:", data);

        if (response.ok) {
            alert("Account created successfully!");
            window.location.href = "login.html";
        } else {
            alert(data.detail || "Registration failed");
        }

    } catch (error) {
        console.error("Register error:", error);
        alert("FastAPI not connected");
    }
}


async function loginUser() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Please enter email and password");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        console.log("Login response:", data);

        if (response.ok) {

            if (data.access_token) {
                localStorage.setItem(
                    "access_token",
                    data.access_token
                );
            }

            alert("Login successful!");

            window.location.href = "index.html";

        } else {
            alert(data.detail || "Login failed");
        }

    } catch (error) {
        console.error("Login error:", error);
        alert("FastAPI not connected");
    }
}


document.addEventListener("DOMContentLoaded", () => {

    const registerForm = document.getElementById("registerForm");

    if (registerForm) {
        registerForm.addEventListener("submit", (event) => {
            event.preventDefault();
            registerUser();
        });
    }


    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
        loginForm.addEventListener("submit", (event) => {
            event.preventDefault();
            loginUser();
        });
    }

});
