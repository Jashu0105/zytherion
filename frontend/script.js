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
   /* ============================================================================
   PHASE 9: ADVANCED SEARCH - ADD THIS TO YOUR SCRIPT.JS
   ============================================================================ */

// Search state
let searchResults = [];
let currentSearchQuery = "";

// Show advanced search modal
function showAdvancedSearch() {
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
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        text-align: left;
        backdrop-filter: blur(20px);
    `;

    content.innerHTML = `
        <h2 style="color: #d1a85c; margin-bottom: 20px; font-size: 24px;">🔍 Advanced Search</h2>
        
        <div style="display: flex; flex-direction: column; gap: 20px;">
            
            <!-- Keyword Search -->
            <div>
                <label style="display: block; color: #d1a85c; margin-bottom: 8px; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Keyword</label>
                <input type="text" id="searchKeyword" placeholder="Search messages..." style="
                    width: 100%;
                    padding: 12px 16px;
                    background: rgba(4, 6, 10, 0.6);
                    border: 1px solid rgba(209, 168, 92, 0.2);
                    border-radius: 8px;
                    color: #f8fafc;
                    font-size: 14px;
                    outline: none;
                    transition: all 0.2s;
                " onkeyup="this.style.borderColor = this.value ? 'rgba(209, 168, 92, 0.5)' : 'rgba(209, 168, 92, 0.2)'">
            </div>

            <!-- Filter by Message Type -->
            <div>
                <label style="display: block; color: #d1a85c; margin-bottom: 8px; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Message Type</label>
                <div style="display: flex; gap: 10px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #f8fafc;">
                        <input type="radio" name="messageType" value="all" checked>
                        All Messages
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #f8fafc;">
                        <input type="radio" name="messageType" value="user">
                        Your Messages
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #f8fafc;">
                        <input type="radio" name="messageType" value="bot">
                        AI Responses
                    </label>
                </div>
            </div>

            <!-- Date Range Filter -->
            <div>
                <label style="display: block; color: #d1a85c; margin-bottom: 8px; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Date Range</label>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display: block; color: #64748b; margin-bottom: 5px; font-size: 12px;">From</label>
                        <input type="date" id="dateFrom" style="
                            width: 100%;
                            padding: 10px 12px;
                            background: rgba(4, 6, 10, 0.6);
                            border: 1px solid rgba(209, 168, 92, 0.2);
                            border-radius: 8px;
                            color: #f8fafc;
                            font-size: 13px;
                            outline: none;
                        ">
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display: block; color: #64748b; margin-bottom: 5px; font-size: 12px;">To</label>
                        <input type="date" id="dateTo" style="
                            width: 100%;
                            padding: 10px 12px;
                            background: rgba(4, 6, 10, 0.6);
                            border: 1px solid rgba(209, 168, 92, 0.2);
                            border-radius: 8px;
                            color: #f8fafc;
                            font-size: 13px;
                            outline: none;
                        ">
                    </div>
                </div>
            </div>

            <!-- Buttons -->
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button id="searchBtn" style="
                    flex: 1;
                    padding: 12px 20px;
                    background: linear-gradient(135deg, #d1a85c 0%, #b89146 100%);
                    border: none;
                    border-radius: 8px;
                    color: #02040a;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                ">🔍 Search</button>
                
                <button id="closeSearch" style="
                    flex: 1;
                    padding: 12px 20px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    color: inherit;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                ">Cancel</button>
            </div>

            <!-- Results Display -->
            <div id="searchResults" style="
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(209, 168, 92, 0.1);
                border-radius: 8px;
                padding: 16px;
                max-height: 300px;
                overflow-y: auto;
                display: none;
            ">
                <div id="resultsContent"></div>
            </div>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Set today's date as default end date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateTo').value = today;

    // Set a week ago as default start date
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById('dateFrom').value = weekAgo;

    document.getElementById('searchBtn').onclick = performSearch;
    document.getElementById('closeSearch').onclick = () => modal.remove();
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

// Perform the search
function performSearch() {
    const keyword = document.getElementById('searchKeyword').value.toLowerCase();
    const messageType = document.querySelector('input[name="messageType"]:checked').value;
    const dateFrom = new Date(document.getElementById('dateFrom').value || '2000-01-01');
    const dateTo = new Date(document.getElementById('dateTo').value || '2099-12-31');
    dateTo.setHours(23, 59, 59); // Include entire last day

    const activeSession = chatSessions.find(s => s.id === currentSessionId);
    if (!activeSession) {
        showErrorNotification("No active session to search");
        return;
    }

    // Filter messages
    searchResults = activeSession.messages.filter(msg => {
        // Check keyword match
        const matchesKeyword = !keyword || msg.text.toLowerCase().includes(keyword);
        
        // Check message type
        const matchesType = messageType === 'all' || msg.sender === messageType;
        
        // Check date range (assume messages were created during this session)
        const messageDate = new Date(activeSession.timestamp || Date.now());
        const matchesDate = messageDate >= dateFrom && messageDate <= dateTo;
        
        return matchesKeyword && matchesType && matchesDate;
    });

    displaySearchResults(keyword, messageType);
}

// Display search results
function displaySearchResults(keyword, messageType) {
    const resultsDiv = document.getElementById('searchResults');
    const resultsContent = document.getElementById('resultsContent');
    
    resultsContent.innerHTML = '';
    
    if (searchResults.length === 0) {
        resultsContent.innerHTML = `<p style="color: #64748b; text-align: center; padding: 20px;">No messages found</p>`;
        resultsDiv.style.display = 'block';
        return;
    }

    let html = `<p style="color: #d1a85c; margin-bottom: 15px; font-weight: 600;">Found ${searchResults.length} result(s)</p>`;
    
    searchResults.forEach((msg, index) => {
        const sender = msg.sender === 'user' ? '👤 You' : '🤖 AI';
        let displayText = msg.text;
        
        // Highlight keyword if provided
        if (keyword) {
            const regex = new RegExp(`(${keyword})`, 'gi');
            displayText = displayText.replace(regex, '<span style="background: rgba(209, 168, 92, 0.5); color: #fff; padding: 2px 4px; border-radius: 3px;">$1</span>');
        }
        
        html += `
            <div style="
                background: rgba(209, 168, 92, 0.08);
                border: 1px solid rgba(209, 168, 92, 0.15);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
            ">
                <p style="color: #d1a85c; font-size: 12px; font-weight: 600; margin-bottom: 6px;">${sender}</p>
                <p style="color: #f8fafc; font-size: 13px; line-height: 1.5;">${displayText}</p>
            </div>
        `;
    });
    
    resultsContent.innerHTML = html;
    resultsDiv.style.display = 'block';
}

// Search in all sessions
function searchAllSessions() {
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
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        backdrop-filter: blur(20px);
    `;

    content.innerHTML = `
        <h2 style="color: #d1a85c; margin-bottom: 20px; font-size: 24px;">🔎 Search All Sessions</h2>
        
        <input type="text" id="globalSearchKeyword" placeholder="Search across all chats..." style="
            width: 100%;
            padding: 12px 16px;
            background: rgba(4, 6, 10, 0.6);
            border: 1px solid rgba(209, 168, 92, 0.2);
            border-radius: 8px;
            color: #f8fafc;
            font-size: 14px;
            outline: none;
            margin-bottom: 15px;
            transition: all 0.2s;
        " onkeyup="this.style.borderColor = this.value ? 'rgba(209, 168, 92, 0.5)' : 'rgba(209, 168, 92, 0.2)'">

        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <button id="globalSearchBtn" style="
                flex: 1;
                padding: 12px 20px;
                background: linear-gradient(135deg, #d1a85c 0%, #b89146 100%);
                border: none;
                border-radius: 8px;
                color: #02040a;
                cursor: pointer;
                font-weight: 600;
            ">Search</button>
            
            <button id="closeGlobalSearch" style="
                flex: 1;
                padding: 12px 20px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: inherit;
                cursor: pointer;
                font-weight: 600;
            ">Cancel</button>
        </div>

        <div id="globalSearchResults" style="
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(209, 168, 92, 0.1);
            border-radius: 8px;
            padding: 16px;
            max-height: 400px;
            overflow-y: auto;
            display: none;
        ">
            <div id="globalResultsContent"></div>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    document.getElementById('globalSearchBtn').onclick = () => {
        const keyword = document.getElementById('globalSearchKeyword').value.toLowerCase();
        if (!keyword) {
            showErrorNotification("Please enter a search term");
            return;
        }

        const allResults = [];
        chatSessions.forEach(session => {
            const matches = session.messages.filter(msg => 
                msg.text.toLowerCase().includes(keyword)
            );
            if (matches.length > 0) {
                allResults.push({
                    sessionTitle: session.title,
                    messages: matches
                });
            }
        });

        const resultsDiv = document.getElementById('globalSearchResults');
        const resultsContent = document.getElementById('globalResultsContent');
        resultsContent.innerHTML = '';

        if (allResults.length === 0) {
            resultsContent.innerHTML = `<p style="color: #64748b; text-align: center;">No results found in any session</p>`;
            resultsDiv.style.display = 'block';
            return;
        }

        let html = `<p style="color: #d1a85c; margin-bottom: 15px; font-weight: 600;">Found in ${allResults.length} session(s)</p>`;
        
        allResults.forEach(result => {
            html += `<h3 style="color: #d1a85c; font-size: 13px; margin: 15px 0 10px 0; font-weight: 600;">📌 ${result.sessionTitle}</h3>`;
            
            result.messages.forEach(msg => {
                const sender = msg.sender === 'user' ? '👤' : '🤖';
                let displayText = msg.text;
                const regex = new RegExp(`(${keyword})`, 'gi');
                displayText = displayText.replace(regex, '<span style="background: rgba(209, 168, 92, 0.5); color: #fff; padding: 2px 4px; border-radius: 3px;">$1</span>');
                
                html += `
                    <div style="
                        background: rgba(209, 168, 92, 0.08);
                        border: 1px solid rgba(209, 168, 92, 0.15);
                        border-radius: 8px;
                        padding: 10px;
                        margin-bottom: 8px;
                    ">
                        <p style="color: #f8fafc; font-size: 12px; line-height: 1.5;">${sender} ${displayText}</p>
                    </div>
                `;
            });
        });
        
        resultsContent.innerHTML = html;
        resultsDiv.style.display = 'block';
    };

    document.getElementById('closeGlobalSearch').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

/* ============================================================================
   END PHASE 9 CODE - Add the above to your script.js
   ============================================================================ */