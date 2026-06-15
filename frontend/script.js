// --- DOM ELEMENTS ---
const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const localHistoryContainer = document.getElementById("localHistory");
const clearLogsBtn = document.getElementById("clearLogsBtn");
// Note: Ensure you added id="newChatBtn" to your HTML "+ New Chat" button
const newChatBtn = document.getElementById("newChatBtn"); 

// --- ENVIRONMENT ROUTER ---
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/chat"
    : "https://aegisai-backend-ifvc.onrender.com/chat";

// --- STATE MANAGEMENT ---
// Restructured to track an array of sessions and the active session pointer
let chatSessions = JSON.parse(localStorage.getItem("zytherion_sessions")) || [];
let currentSessionId = localStorage.getItem("zytherion_current_session_id") || null;

// --- INITIALIZATION LIFECYCLE ---
document.addEventListener("DOMContentLoaded", () => {
    // If no sessions exist, or the stored session pointer is missing, initialize a clean canvas
    if (chatSessions.length === 0 || !currentSessionId || !chatSessions.find(s => s.id === currentSessionId)) {
        createNewSession(false); // Bootstrap state quietly without double rendering
    }
    
    renderSidebarSessions();
    renderActiveChatLogs();

    // Structural UI Trigger Hooks
    sendBtn.addEventListener("click", sendMessage);
    userInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });

    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => createNewSession(true));
    }
});

// --- SESSION MANIPULATION FUNCTIONS ---

// Instantiates a new isolated chat workspace session object
function createNewSession(shouldRender = true) {
    const newSession = {
        id: "session_" + Date.now(),
        title: "New Chat Session",
        messages: [],
        timestamp: new Date().toISOString()
    };

    chatSessions.unshift(newSession); // Newest sessions surface to top of list
    currentSessionId = newSession.id;

    saveStateToStorage();

    if (shouldRender) {
        renderSidebarSessions();
        renderActiveChatLogs();
    }
}

// Persists global application session states to localStorage
function saveStateToStorage() {
    localStorage.setItem("zytherion_sessions", JSON.stringify(chatSessions));
    localStorage.setItem("zytherion_current_session_id", currentSessionId);
}

// --- RENDERING PIPELINES ---

// Repopulates viewport frames based on the currently selected active session
function renderActiveChatLogs() {
    chatContainer.innerHTML = "";
    
    const activeSession = chatSessions.find(s => s.id === currentSessionId);
    
    // Default boot onboarding interface template if the chosen session workspace has no messages
    if (!activeSession || activeSession.messages.length === 0) {
        appendChatBubbleUI(`🚀 ZYTHERION: Think Bigger. Build Faster.
The next-gen AI powered by adaptive reasoning and limitless creativity. Your imagination is the only limit.
➜ 🧠 Enter the future ✨`, "bot");
        return;
    }

    activeSession.messages.forEach(item => {
        appendChatBubbleUI(item.text, item.sender);
    });
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Pure rendering helper to inject message structures cleanly into the document tree
function appendChatBubbleUI(text, sender) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender);
    msgDiv.innerText = text;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msgDiv; // Return element reference for temporary manipulation states (like loading strings)
}

// Sidebar session list panel navigation renderer
function renderSidebarSessions() {
    localHistoryContainer.innerHTML = "";

    if (chatSessions.length === 0) {
        const emptyTab = document.createElement("div");
        emptyTab.classList.add("history-item");
        emptyTab.style.color = "var(--text-muted)";
        emptyTab.style.cursor = "default";
        emptyTab.innerText = "No active records";
        localHistoryContainer.appendChild(emptyTab);
        return;
    }

    chatSessions.forEach(session => {
        const linkTab = document.createElement("div");
        linkTab.classList.add("history-item");
        linkTab.innerText = session.title;

        // Visual distinction indicator rule for the active track index highlight
        if (session.id === currentSessionId) {
            linkTab.style.background = "var(--glass-bg)";
            linkTab.style.borderColor = "var(--glass-border)";
            linkTab.style.fontWeight = "500";
        }

        // Click routing command to pivot data contexts dynamically
        linkTab.addEventListener("click", () => {
            currentSessionId = session.id;
            localStorage.setItem("zytherion_current_session_id", currentSessionId);
            renderSidebarSessions();
            renderActiveChatLogs();
        });

        localHistoryContainer.appendChild(linkTab);
    });
}

// --- REQUEST FORWARDING EXECUTION NODE ---

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    let activeSession = chatSessions.find(s => s.id === currentSessionId);
    if (!activeSession) return;

    // Clear initial greeting presentation if this is the opening message text block
    if (activeSession.messages.length === 0) {
        chatContainer.innerHTML = "";
        // Extract starting topic as title snippet
        activeSession.title = message.length > 28 ? message.substring(0, 25) + "..." : message;
    }

    // 1. Commit and push user message data parameters into local state arrays
    activeSession.messages.push({ text: message, sender: "user" });
    appendChatBubbleUI(message, "user");
    userInput.value = "";
    saveStateToStorage();
    renderSidebarSessions(); // Update sidebar immediately to show title change

    // 2. Display thinking state indicator layout across active container wrapper
    const loadingDiv = appendChatBubbleUI("Zytherion is thinking...", "bot");
    loadingDiv.style.opacity = "0.7";

    try {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "login.html";
            return;
        }

        // 3. Fire payload delivery downstream to API cluster
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ message: message })
        });

        // 4. Intercept session security expiration actions
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return;
        }

        const data = await response.json();
        loadingDiv.remove();

        // 5. Unpack reply definitions and append safely to the active array channel
        const botReplyText = data.reply || data.botReply || data.message || "Error: Unexpected response format.";
        
        activeSession.messages.push({ text: botReplyText, sender: "bot" });
        appendChatBubbleUI(botReplyText, "bot");
        saveStateToStorage();

    } catch (error) {
        loadingDiv.remove();
        const errorDiv = appendChatBubbleUI("Connection error. Unable to reach the Zytherion engine.", "bot");
        errorDiv.style.borderColor = "rgba(239, 68, 68, 0.2)";
        console.error("Engine Processing Error:", error);
    }
}

// --- SYSTEM RESET EVENT HANDLERS ---
clearLogsBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to permanently clear all localized conversation logs?")) {
        localStorage.removeItem("zytherion_sessions");
        localStorage.removeItem("zytherion_current_session_id");
        chatSessions = [];
        currentSessionId = null;
        
        // Regenerate an empty initial chat context framework
        createNewSession(true);
    }
});