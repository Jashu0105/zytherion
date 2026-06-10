const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const localHistoryContainer = document.getElementById("localHistory");
const clearLogsBtn = document.getElementById("clearLogsBtn");

// Production vs Local Environment Router
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/chat"
    : "https://aegisai-backend-ifvc.onrender.com/chat";

// Local Storage Memory Arrays Configuration
let activeChatHistory = JSON.parse(localStorage.getItem("zytherion_chat_history")) || [];

// Initialization Lifecycle Event Runner
document.addEventListener("DOMContentLoaded", () => {
    renderSavedLogs();
    renderSidebarSessions();
});

// Render saved local elements to the stream viewport
function renderSavedLogs() {
    chatContainer.innerHTML = "";
    
    // Default system boot greeting if local logs are completely clean
    if (activeChatHistory.length === 0) {
        appendChatBubble(`🚀 ZYTHERION

The Next Generation of Artificial Intelligence

Analyze deeper. Build faster. Think bigger.
Powered by adaptive intelligence, advanced reasoning, and limitless creativity.

Your imagination is the only limit.

➜ 🧠 Enter the future ✨`, "bot", false);
        return;
    }

    activeChatHistory.forEach(item => {
        appendChatBubble(item.text, item.sender, false);
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Append visual element strings into the active tracking window
function appendChatBubble(text, sender, isSavingRequired = true) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender);
    msgDiv.innerText = text;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (isSavingRequired) {
        activeChatHistory.push({ text: text, sender: sender });
        localStorage.setItem("zytherion_chat_history", JSON.stringify(activeChatHistory));
        renderSidebarSessions();
    }
}

// Sidebar session elements updater panel
function renderSidebarSessions() {
    localHistoryContainer.innerHTML = "";
    
    // Extract individual user questions to build clean, minimalist menu options
    const userPromptsOnly = activeChatHistory.filter(m => m.sender === "user");
    
    if (userPromptsOnly.length === 0) {
        const emptyTab = document.createElement("div");
        emptyTab.classList.add("history-item");
        emptyTab.style.color = "var(--text-muted)";
        emptyTab.style.cursor = "default";
        emptyTab.innerText = "No active records";
        localHistoryContainer.appendChild(emptyTab);
        return;
    }

    // Display unique conversation points in chronological order
    userPromptsOnly.slice(-6).reverse().forEach(prompt => {
        const linkTab = document.createElement("div");
        linkTab.classList.add("history-item");
        linkTab.innerText = prompt.text;
        localHistoryContainer.appendChild(linkTab);
    });
}

// System Request Forwarding Execution Node
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // 1. Immediately place user string on screen and into local system memory arrays
    appendChatBubble(message, "user", true);
    userInput.value = "";

    // 2. Display smooth visual status indicator layout 
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("message", "bot");
    loadingDiv.style.opacity = "0.7";
    loadingDiv.innerText = "Zytherion is thinking...";
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "login.html";
            return;
        }

        // 3. Fire request to engine API cluster
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ message: message })
        });

        // 4. Intercept session authentication expirations
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return;
        }

        const data = await response.json();
        loadingDiv.remove();

        // 5. Unpack reply parameters and update persistent logs
        const botReplyText = data.reply || data.botReply || data.message || "Error: Unexpected response format.";
        appendChatBubble(botReplyText, "bot", true);

    } catch (error) {
        loadingDiv.remove();
        const errorDiv = document.createElement("div");
        errorDiv.classList.add("message", "bot");
        errorDiv.style.borderColor = "rgba(239, 68, 68, 0.2)";
        errorDiv.innerText = "Connection error. Unable to reach the Zytherion engine.";
        chatContainer.appendChild(errorDiv);
        console.error("Engine Processing Error:", error);
    }
}

// Clear system cache tracking arrays
clearLogsBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all local chat histories?")) {
        localStorage.removeItem("zytherion_chat_history");
        activeChatHistory = [];
        renderSavedLogs();
        renderSidebarSessions();
    }
});

// Structural UI Trigger Hooks
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
});