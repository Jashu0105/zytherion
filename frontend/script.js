// ============================================================
// ZYTHERION AI - IMPROVED SCRIPT.JS
// Features: Auto-grow textarea, copy buttons, edit buttons,
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
let editingMessageIndex = null; // Track which message is being edited

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
    activeSession.messages.forEach((item, index) => {
        appendChatBubbleUI(item.text, item.sender, index);
    });
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendChatBubbleUI(text, sender, messageIndex = null) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender);
    msgDiv.setAttribute("data-message-index", messageIndex);
    
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
        addUserActionButtons(msgDiv, text, messageIndex);
    }
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return msgDiv;
}

// Add Copy + Edit buttons for user messages
function addUserActionButtons(msgDiv, text, messageIndex) {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
    `;
    
    // Edit button
    const editBtn = document.createElement("button");
    editBtn.innerHTML = "✏️ Edit";
    editBtn.style.cssText = `
        padding: 6px 12px;
        background: rgba(99, 102, 241, 0.15);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 6px;
        color: #6366f1;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
    `;
    
    editBtn.onmouseover = () => {
        editBtn.style.background = "rgba(99, 102, 241, 0.25)";
        editBtn.style.borderColor = "rgba(99, 102, 241, 0.5)";
    };
    
    editBtn.onmouseout = () => {
        editBtn.style.background = "rgba(99, 102, 241, 0.15)";
        editBtn.style.borderColor = "rgba(99, 102, 241, 0.3)";
    };
    
    editBtn.onclick = () => {
        userInput.value = text;
        userInput.style.height = 'auto';
        autoGrowTextarea();
        userInput.focus();
        editingMessageIndex = messageIndex;
        editBtn.innerHTML = "✓ Ready to edit";
        editBtn.style.background = "rgba(16, 185, 129, 0.2)";
        editBtn.style.borderColor = "rgba(16, 185, 129, 0.5)";
    };
    
    // Copy button
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
    
    buttonContainer.appendChild(editBtn);
    buttonContainer.appendChild(copyBtn);
    msgDiv.appendChild(buttonContainer);
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

function renderSidebarSessions() {
    if (!localHistoryContainer) return;

    localHistoryContainer.innerHTML = "";

    chatSessions.forEach(session => {
        const sessionBtn = document.createElement("button");
        sessionBtn.textContent = session.title;
        sessionBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 10px;
            margin-bottom: 8px;
            background: ${currentSessionId === session.id ? "rgba(209, 168, 92, 0.2)" : "rgba(255, 255, 255, 0.05)"};
            border: 1px solid ${currentSessionId === session.id ? "rgba(209, 168, 92, 0.5)" : "rgba(255, 255, 255, 0.1)"};
            border-radius: 8px;
            color: inherit;
            cursor: pointer;
            text-align: left;
            font-size: 13px;
            transition: all 0.2s ease;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;

        sessionBtn.onmouseover = () => {
            sessionBtn.style.background = "rgba(209, 168, 92, 0.15)";
            sessionBtn.style.borderColor = "rgba(209, 168, 92, 0.4)";
        };

        sessionBtn.onmouseout = () => {
            if (currentSessionId !== session.id) {
                sessionBtn.style.background = "rgba(255, 255, 255, 0.05)";
                sessionBtn.style.borderColor = "rgba(255, 255, 255, 0.1)";
            }
        };

        sessionBtn.onclick = () => {
            currentSessionId = session.id;
            saveStateToStorage();
            renderSidebarSessions();
            renderActiveChatLogs();
        };

        localHistoryContainer.appendChild(sessionBtn);
    });
}

/* ================= TOKEN MANAGEMENT ================= */
function decodeToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const decoded = JSON.parse(atob(parts[1]));
        return decoded;
    } catch (error) {
        console.error("Token decode error:", error);
        return null;
    }
}

function checkTokenExpiry() {
    try {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "login.html";
            return;
        }

        const payload = decodeToken(token);
        if (!payload || !payload.exp) {
            throw new Error("Invalid token payload");
        }

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
    appendChatBubbleUI(message, "user", activeSession.messages.length - 1);
    userInput.value = "";
    userInput.style.height = 'auto'; // Reset textarea height
    updateCharacterCounter();
    editingMessageIndex = null; // Reset editing state
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
        appendChatBubbleUI(botReplyText, "bot", activeSession.messages.length - 1);
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
/* ============================================================================
   PHASE 8: MESSAGE EXPORT - ADD THIS TO YOUR SCRIPT.JS
   ============================================================================ */

// Export current chat as JSON
function exportAsJSON() {
    const activeSession = chatSessions.find(s => s.id === currentSessionId);
    if (!activeSession || activeSession.messages.length === 0) {
        showErrorNotification("No messages to export");
        return;
    }

    const exportData = {
        title: activeSession.title,
        date: new Date().toLocaleString(),
        messageCount: activeSession.messages.length,
        messages: activeSession.messages
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zytherion-chat-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showErrorNotification("✅ Chat exported as JSON");
}

// Export current chat as TXT
function exportAsTXT() {
    const activeSession = chatSessions.find(s => s.id === currentSessionId);
    if (!activeSession || activeSession.messages.length === 0) {
        showErrorNotification("No messages to export");
        return;
    }

    let txtContent = `ZYTHERION AI - Chat Export\n`;
    txtContent += `Title: ${activeSession.title}\n`;
    txtContent += `Date: ${new Date().toLocaleString()}\n`;
    txtContent += `Messages: ${activeSession.messages.length}\n`;
    txtContent += `${'='.repeat(60)}\n\n`;

    activeSession.messages.forEach((msg, index) => {
        const sender = msg.sender === 'user' ? '👤 YOU' : '🤖 ZYTHERION';
        txtContent += `[${index + 1}] ${sender}\n`;
        txtContent += `${msg.text}\n`;
        txtContent += `${'-'.repeat(60)}\n`;
    });

    const blob = new Blob([txtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zytherion-chat-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showErrorNotification("✅ Chat exported as TXT");
}

// Export current chat as PDF (using jsPDF)
function exportAsPDF() {
    const activeSession = chatSessions.find(s => s.id === currentSessionId);
    if (!activeSession || activeSession.messages.length === 0) {
        showErrorNotification("No messages to export");
        return;
    }

    // Check if jsPDF is loaded
    if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
        showErrorNotification("PDF library loading... Please try again in a moment");
        return;
    }

    try {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 20;
        const lineHeight = 7;
        const maxWidth = pageWidth - 20;

        // Header
        doc.setFontSize(16);
        doc.text('Zytherion AI - Chat Export', 10, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.text(`Title: ${activeSession.title}`, 10, yPosition);
        yPosition += 6;
        doc.text(`Date: ${new Date().toLocaleString()}`, 10, yPosition);
        yPosition += 6;
        doc.text(`Total Messages: ${activeSession.messages.length}`, 10, yPosition);
        yPosition += 10;

        doc.setDrawColor(200);
        doc.line(10, yPosition, pageWidth - 10, yPosition);
        yPosition += 10;

        // Messages
        doc.setFontSize(9);
        activeSession.messages.forEach((msg, index) => {
            const sender = msg.sender === 'user' ? '👤 You' : '🤖 Zytherion';
            
            // Check if we need a new page
            if (yPosition > pageHeight - 20) {
                doc.addPage();
                yPosition = 20;
            }

            // Sender label
            doc.setFont(undefined, 'bold');
            doc.setTextColor(209, 168, 92); // Gold color
            doc.text(`[${index + 1}] ${sender}`, 10, yPosition);
            yPosition += lineHeight;

            // Message text
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            const lines = doc.splitTextToSize(msg.text, maxWidth - 10);
            doc.text(lines, 15, yPosition);
            yPosition += lines.length * lineHeight + 5;

            // Separator
            doc.setDrawColor(220);
            doc.line(10, yPosition, pageWidth - 10, yPosition);
            yPosition += 5;
        });

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Exported from Zytherion AI', 10, pageHeight - 10);

        doc.save(`zytherion-chat-${Date.now()}.pdf`);
        showErrorNotification("✅ Chat exported as PDF");

    } catch (error) {
        console.error("PDF export error:", error);
        showErrorNotification("PDF export failed: " + error.message);
    }
}

// Show export menu
function showExportMenu() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(209, 168, 92, 0.3);
        border-radius: 15px;
        padding: 30px;
        max-width: 400px;
        text-align: center;
        backdrop-filter: blur(20px);
    `;

    content.innerHTML = `
        <h2 style="color: #d1a85c; margin-bottom: 20px; font-size: 24px;">📥 Export Chat</h2>
        <p style="color: #64748b; margin-bottom: 25px;">Choose export format:</p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="exportJSON" style="
                padding: 12px 20px;
                background: rgba(99, 102, 241, 0.2);
                border: 1px solid rgba(99, 102, 241, 0.4);
                border-radius: 8px;
                color: #6366f1;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            ">📄 Export as JSON</button>
            
            <button id="exportTXT" style="
                padding: 12px 20px;
                background: rgba(16, 185, 129, 0.2);
                border: 1px solid rgba(16, 185, 129, 0.4);
                border-radius: 8px;
                color: #10b981;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            ">📝 Export as TXT</button>
            
            <button id="exportPDF" style="
                padding: 12px 20px;
                background: rgba(239, 68, 68, 0.2);
                border: 1px solid rgba(239, 68, 68, 0.4);
                border-radius: 8px;
                color: #ef4444;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            ">🔴 Export as PDF</button>
            
            <button id="closeExport" style="
                padding: 12px 20px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: inherit;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
                margin-top: 10px;
            ">Cancel</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    document.getElementById('exportJSON').onclick = () => {
        exportAsJSON();
        modal.remove();
    };

    document.getElementById('exportTXT').onclick = () => {
        exportAsTXT();
        modal.remove();
    };

    document.getElementById('exportPDF').onclick = () => {
        exportAsPDF();
        modal.remove();
    };

    document.getElementById('closeExport').onclick = () => {
        modal.remove();
    };

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

/* ============================================================================
   END PHASE 8 CODE - Add the above to your script.js
   ============================================================================ */