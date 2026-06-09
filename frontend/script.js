const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const BACKEND_URL = "https://aegisai-backend-ifvc.onrender.com/chat";

// Send message function
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Show user message
    const userDiv = document.createElement("div");
    userDiv.classList.add("message", "user");
    userDiv.innerText = message;
    chatContainer.appendChild(userDiv);

    userInput.value = "";

    // Show loading message
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
// Locate where your script fetches from the server backend
const response = await fetch("http://localhost:3000/chat", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}` // if using JWT
    },
    body: JSON.stringify({ message: userInputText })
});

const data = await response.json();

// ==========================================
// REPLACE YOUR CRASHING RESPONSE PARSER WITH THIS:
// ==========================================
const finalResponseText = data.reply || data.botReply || data.message || data.error;

if (finalResponseText) {
    // Note: Change 'appendMessage' to match your exact function name for adding text bubbles!
    appendMessage("assistant", finalResponseText); 
} else {
    appendMessage("assistant", "Error: Unexpected response format.");
    console.error("Data tracking mismatched. Received from server:", data);
}
        if (response.status === 401 || response.status === 403) {
            // Token is invalid or expired
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return;
        }

        const data = await response.json();

        loadingDiv.remove();

        const botDiv = document.createElement("div");
        botDiv.classList.add("message", "bot");
        botDiv.innerText = data.reply || "Error: Unexpected response format.";
        chatContainer.appendChild(botDiv);

        chatContainer.scrollTop = chatContainer.scrollHeight;

    } catch (error) {
        loadingDiv.remove();

        const errorDiv = document.createElement("div");
        errorDiv.classList.add("message", "bot");
        errorDiv.innerText = "Connection error. Please try again.";
        chatContainer.appendChild(errorDiv);
        console.error("Chat Error:", error);
    }
}

// Button click
sendBtn.addEventListener("click", sendMessage);

// Enter key support
userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(() => console.log("Service Worker Registered"))
      .catch(err => console.log("Service Worker Error:", err));
  });
}