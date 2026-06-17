// ============================================================
// ZYTHERION AI - IMPROVED SCRIPT.JS
// Features: Auto-grow textarea, copy buttons, delete buttons,
// typing indicator, token refresh, better error handling
// ============================================================

/* ================= DOM ELEMENTS ================= */
const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const localHistoryContainer = document.getElementById("localHistory");
const clearLogsBtn = document.getElementById("clearLogsBtn");
const newChatBtn = document.getElementById("newChatBtn");

/* ================= ENVIRONMENT & CONFIG ================= */
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/chat"
    : "https://aegisai-backend-ifvc.onrender.com/chat";

const TOKEN_REFRESH_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api/auth/refresh"
    : "https://aegisai-backend-ifvc.onrender.com/api/auth/refresh";

const MESSAGE_MAX_LENGTH = 5000;
const TYPING_INDICATOR_TEXT = "Zytherion is thinking";

/* ================= STATE MANAGEMENT ================= */
let chatSessions = JSON.parse(localStorage.getItem("zytherion_sessions")) || [];
let currentSessionId = localStorage.getItem("zytherion_current_session_id") || null;
let isLoading = false; // Prevent duplicate messages

/* ================= INITIALIZATION ================= */
document.addEventListener("DOMContentLoaded", () => {
    // Bootstrap sessions if needed
    if (chatSessions.length === 0 || !currentSessionId || !chatSessions.find(s => s.id === currentSessionId)) {
        createNewSession(false);
    }
    
    renderSidebarSessions();
    renderActiveChatLogs();

    // Event listeners for message sending
    sendBtn.addEventListener("click", sendMessage);
    userInput.addEventListener("keydown", handleKeyPress);
    
    // Auto-grow textarea
    userInput.addEventListener("input", autoGrowTextarea);
    
    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => createNewSession(true));
    }

    // Check if token needs refresh on page load
    checkTokenExpiry();
});

/* ================= TEXTAREA AUTO-GROW ================= */
function autoGrowTextarea() {
    // Reset height to auto to get scrollHeight
    userInput.style.height = 'auto';
    
    // Set new height based on scrollHeight (capped at max-height)
    const newHeight = Math.min(userInput.scrollHeight, 120);
    userInput.style.height = newHeight + 'px';
    
    // Update character counter if it exists
    updateCharacterCounter();
}

function updateCharacterCounter() {
    const charCountEl = document.getElementById("char-count");
    if (charCountEl) {
        const remaining = MESSAGE_MAX_LENGTH - userInput.value.length;
        charCountEl.textContent = `${userInput.value.length}/${MESSAGE_MAX_LENGTH}`;
        
        if (remaining < 100) {
            charCountEl.style.color = '#ef4444'; // Red warning
        } else {
            charCountEl.style.color = '#64748b'; // Normal gray
        }
    }
}

/* ================= KEYBOARD HANDLING ================= */
function handleKeyPress(e) {
    // Send message on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    // Allow new line on Shift + Enter
    // (default behavior, no need to handle)
}

/* ================= SESSION MANAGEMENT ================= */
function createNewSession(shouldRender = true) {
    const newSession = {
        id: "session_" + Date.now(),
        title: "New Chat Session",
        messages: [],
        timestamp: new Date().toISOString()
    };

    chatSessions.unshift(newSession);
    currentSessionId = newSession.id;

    saveStateToStorage();

    if (shouldRender) {
        renderSidebarSessions();
        renderActiveChatLogs();
    }
}

function saveStateToStorage() {
    localStorage.setItem("zytherion_sessions", JSON.stringify(chatSessions));
    localStorage.setItem("zytherion_current_session_id", currentSessionId);
}

/* ================= RENDERING PIPELINES ================= */
function renderActiveChatLogs() {
    chatContainer.innerHTML = "";
    
    const activeSession = chatSessions.find(s => s.id === currentSessionId);
    
    // Default greeting if no messages
    if (!activeSession || activeSession.messages.length === 0) {
        appendChatBubbleUI(
            `🚀 ZYTHERION: Think Bigger. Build Faster.
The next-gen AI powered by adaptive reasoning and limitless creativity. Your imagination is the only limit.
➜ 🧠 Enter the future ✨`,
            "bot"
        );
        return;
    }

    // Render all messages
    activeSession.messages.forEach(item => {
        appendChatBubbleUI(item.text, item.sender);
    });
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendChatBubbleUI(text, sender) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender);
    
    // Create text content
    const textContent = document.createElement("div");
    textContent.style.wordWrap = "break-word";
    textContent.style.whiteSpace = "pre-wrap";
    textContent.innerText = text;
    msgDiv.appendChild(textContent);
    
    // Add action buttons
    if (sender === "bot") {
        addCopyButton(msgDiv, text);
    } else if (sender === "user") {
        addDeleteButton(msgDiv);
    }
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return msgDiv;
}

// Copy button for bot messages
function addCopyButton(msgDiv, text) {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
    `;
    
    const copyBtn = document.createElement("button");
    copyBtn.innerHTML = "📋 Copy";
    copyBtn.style.cssText = `
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: inherit;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
    `;
    
    copyBtn.onmouseover = () => {
        copyBtn.style.background = "rgba(209, 168, 92, 0.2)";
        copyBtn.style.borderColor = "rgba(209, 168, 92, 0.5)";
    };
    
    copyBtn.onmouseout = () => {
        copyBtn.style.background = "rgba(255, 255, 255, 0.1)";
        copyBtn.style.borderColor = "rgba(255, 255, 255, 0.2)";
    };
    
    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(text);
            copyBtn.innerHTML = "✓ Copied!";
            copyBtn.style.background = "rgba(16, 185, 129, 0.2)";
            copyBtn.style.borderColor = "rgba(16, 185, 129, 0.5)";
            
            setTimeout(() => {
                copyBtn.innerHTML = "📋 Copy";
                copyBtn.style.background = "rgba(255, 255, 255, 0.1)";
                copyBtn.style.borderColor = "rgba(255, 255, 255, 0.2)";
            }, 2000);
        } catch (err) {
            console.error("Copy failed:", err);
            copyBtn.innerHTML = "❌ Copy failed";
            setTimeout(() => copyBtn.innerHTML = "📋 Copy", 2000);
        }
    };
    
    buttonContainer.appendChild(copyBtn);
    msgDiv.appendChild(buttonContainer);
}

// Delete button for user messages
function addDeleteButton(msgDiv) {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
    `;
    
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "🗑️ Delete";
    deleteBtn.style.cssText = `
        padding: 6px 12px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        color: #ef4444;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
    `;
    
    deleteBtn.onmouseover = () => {
        deleteBtn.style.background = "rgba(239, 68, 68, 0.2)";
        deleteBtn.style.borderColor = "rgba(239, 68, 68, 0.5)";
    };
    
    deleteBtn.onmouseout = () => {
        deleteBtn.style.background = "rgba(239, 68, 68, 0.1)";
        deleteBtn.style.borderColor = "rgba(239, 68, 68, 0.3)";
    };
    
    deleteBtn.onclick = () => {
        if (confirm("Delete this message?")) {
            msgDiv.style.opacity = "0";
            msgDiv.style.transform = "translateY(-10px)";
            msgDiv.style.transition = "all 0.3s ease";
            
            setTimeout(() => {
                msgDiv.remove();
                // Also remove from session data
                const activeSession = chatSessions.find(s => s.id === currentSessionId);
                if (activeSession) {
                    activeSession.messages = activeSession.messages.filter(msg => msg.text !== msgDiv.textContent);
                    saveStateToStorage();
                }
            }, 300);
        }
    };
    
    buttonContainer.appendChild(deleteBtn);
    msgDiv.appendChild(buttonContainer);
}

// Sidebar session renderer
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

        // Highlight active session
        if (session.id === currentSessionId) {
            linkTab.style.background = "var(--glass-bg)";
            linkTab.style.borderColor = "var(--glass-border)";
            linkTab.style.fontWeight = "500";
        }

        // Click to switch session
        linkTab.addEventListener("click", () => {
            currentSessionId = session.id;
            localStorage.setItem("zytherion_current_session_id", currentSessionId);
            renderSidebarSessions();
            renderActiveChatLogs();
        });

        localHistoryContainer.appendChild(linkTab);
    });
}

/* ================= TOKEN MANAGEMENT ================= */
function checkTokenExpiry() {
    const token = localStorage.getItem("token");
    const refreshToken = localStorage.getItem("refreshToken");
    
    if (!token) return;
    
    try {
        // Decode JWT to check expiry (basic check)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiryTime = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const timeUntilExpiry = expiryTime - now;
        
        // If token expires in less than 5 minutes, refresh it
        if (timeUntilExpiry < 5 * 60 * 1000) {
            refreshAccessToken();
        }
    } catch (error) {
        console.error("Error checking token expiry:", error);
    }
}

async function refreshAccessToken() {
    try {
        const refreshToken = localStorage.getItem("refreshToken");
        
        if (!refreshToken) {
            console.warn("⚠️ No refresh token found. Please login again.");
            window.location.href = "login.html";
            return;
        }
        
        const response = await fetch(TOKEN_REFRESH_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ refreshToken: refreshToken })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem("token", data.accessToken);
            console.log("✅ Access token refreshed successfully");
        } else {
            console.warn("⚠️ Token refresh failed. Please login again.");
            localStorage.removeItem("token");
            localStorage.removeItem("refreshToken");
            window.location.href = "login.html";
        }
    } catch (error) {
        console.error("❌ Token refresh error:", error);
    }
}

/* ================= MESSAGE SENDING ================= */
async function sendMessage() {
    const message = userInput.value.trim();
    
    // Validation
    if (!message) {
        showErrorNotification("Please enter a message");
        return;
    }
    
    if (message.length > MESSAGE_MAX_LENGTH) {
        showErrorNotification(`Message too long! Max ${MESSAGE_MAX_LENGTH} characters`);
        return;
    }
    
    if (isLoading) {
        showErrorNotification("Please wait for the current message to be processed");
        return;
    }

    let activeSession = chatSessions.find(s => s.id === currentSessionId);
    if (!activeSession) return;

    // Clear greeting if this is the first message
    if (activeSession.messages.length === 0) {
        chatContainer.innerHTML = "";
        activeSession.title = message.length > 28 ? message.substring(0, 25) + "..." : message;
    }

    // Add user message
    activeSession.messages.push({ text: message, sender: "user" });
    appendChatBubbleUI(message, "user");
    userInput.value = "";
    userInput.style.height = 'auto'; // Reset textarea height
    updateCharacterCounter();
    saveStateToStorage();
    renderSidebarSessions();

    // Show thinking state with animated dots
    const loadingDiv = appendChatBubbleUI(TYPING_INDICATOR_TEXT, "bot");
    loadingDiv.style.opacity = "0.7";
    
    let dots = 0;
    const dotInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        loadingDiv.querySelector('div').innerText = TYPING_INDICATOR_TEXT + ".".repeat(dots);
    }, 500);

    isLoading = true;

    try {
        // Get token
        const token = localStorage.getItem("token");
        if (!token) {
            clearInterval(dotInterval);
            loadingDiv.remove();
            window.location.href = "login.html";
            return;
        }

        // Check if token needs refresh before sending
        checkTokenExpiry();

        // Send message to backend
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ message: message })
        });

        // Handle token expiry
        if (response.status === 401 || response.status === 403) {
            console.warn("⚠️ Token expired or invalid");
            localStorage.removeItem("token");
            clearInterval(dotInterval);
            loadingDiv.remove();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Validate response
        if (!data || typeof data !== 'object') {
            throw new Error("Invalid response format from server");
        }

        const botReplyText = data.reply || data.botReply || data.message;
        
        if (!botReplyText || typeof botReplyText !== 'string') {
            throw new Error("No valid reply received from AI");
        }

        // Remove loading indicator
        clearInterval(dotInterval);
        loadingDiv.remove();

        // Add bot response
        activeSession.messages.push({ text: botReplyText, sender: "bot" });
        appendChatBubbleUI(botReplyText, "bot");
        saveStateToStorage();

    } catch (error) {
        clearInterval(dotInterval);
        loadingDiv.remove();
        
        let errorMessage = "Connection error. Unable to reach Zytherion.";
        
        if (error.message.includes("fetch")) {
            errorMessage = "Network error. Check your internet connection.";
        } else if (error.message.includes("Invalid response")) {
            errorMessage = "Server returned invalid data. Try again.";
        } else if (error.message.includes("No valid reply")) {
            errorMessage = "AI did not respond properly. Try again.";
        } else {
            errorMessage = error.message || errorMessage;
        }
        
        showErrorNotification(errorMessage);
        console.error("❌ Message Error:", error);
    } finally {
        isLoading = false;
    }
}

/* ================= ERROR NOTIFICATIONS ================= */
function showErrorNotification(message) {
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 14px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    errorDiv.textContent = "❌ " + message;
    document.body.appendChild(errorDiv);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        errorDiv.style.animation = "slideOut 0.3s ease";
        setTimeout(() => errorDiv.remove(), 300);
    }, 4000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

/* ================= CLEAR LOGS ================= */
clearLogsBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete ALL conversation logs? This cannot be undone.")) {
        localStorage.removeItem("zytherion_sessions");
        localStorage.removeItem("zytherion_current_session_id");
        chatSessions = [];
        currentSessionId = null;
        
        createNewSession(true);
        showErrorNotification("All chat history cleared ✓");
    }
});