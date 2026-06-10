const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Dynamically toggles between local testing and your live Render deployment
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/chat"
    : "https://aegisai-backend-ifvc.onrender.com/chat";

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // 1. Instantly append user chat bubble to screen
    const userDiv = document.createElement("div");
    userDiv.classList.add("message", "user");
    userDiv.innerText = message;
    chatContainer.appendChild(userDiv);

    userInput.value = "";

    // 2. Append temporary visual loading layout indicator
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("message", "bot");
    loadingDiv.innerText = "Zytherion is thinking...";
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "login.html";
            return;
        }

        // 3. Forward the message block string directly to server
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ message: message })
        });

        // 4. Intercept authentication failure codes before stream translation
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return;
        }

        // 5. Parse the body text exactly ONCE to prevent system crashes
        const data = await response.json();
        loadingDiv.remove();

        const botDiv = document.createElement("div");
        botDiv.classList.add("message", "bot");
        
        // Unpack multi-key response structures safely
        botDiv.innerText = data.reply || data.botReply || data.message || "Error: Unexpected response format.";
        chatContainer.appendChild(botDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

    } catch (error) {
        if (chatContainer.contains(loadingDiv)) {
            loadingDiv.remove();
        }

        const errorDiv = document.createElement("div");
        errorDiv.classList.add("message", "bot");
        errorDiv.innerText = "Connection error. Unable to reach the Zytherion engine.";
        chatContainer.appendChild(errorDiv);
        console.error("Engine Connection Error:", error);
    }
}

// Interactive Trigger Nodes
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
});