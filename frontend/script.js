const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Pointing directly to your local running node backend
const BACKEND_URL = "http://localhost:3000/chat";

async function sendMessage() {
    const messageText = userInput.value.trim();
    if (!messageText) return;

    // 1. Render user message bubble on screen
    const userDiv = document.createElement("div");
    userDiv.classList.add("message", "user");
    userDiv.innerText = messageText;
    chatContainer.appendChild(userDiv);

    userInput.value = "";

    // 2. Render temporary loading placeholder
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

        // 3. Post to the backend cleanly using the correct message text variable
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ message: messageText })
        });

        // 4. Handle token expiration BEFORE parsing the JSON body
        if (response.status === 401 || response.status === 403) {
            console.error("Session expired or invalid token. Redirecting...");
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return;
        }

        // 5. Parse the body exactly ONCE
        const data = await response.json();
        loadingDiv.remove();

        // 6. Output response bubble safely matching all potential server payload keys
        const botDiv = document.createElement("div");
        botDiv.classList.add("message", "bot");
        
        botDiv.innerText = data.reply || data.botReply || data.message || "Error: Unexpected response format.";
        chatContainer.appendChild(botDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

    } catch (error) {
        if (document.body.contains(loadingDiv)) {
            loadingDiv.remove();
        }
        
        const errorDiv = document.createElement("div");
        errorDiv.classList.add("message", "bot");
        errorDiv.innerText = "Connection error. Please check if your server is running.";
        chatContainer.appendChild(errorDiv);
        console.error("Chat Error Context:", error);
    }
}

// Event Triggers
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
});