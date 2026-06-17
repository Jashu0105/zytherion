/* ================= IMPORTS & SETUP ================= */
require("dotenv").config(); 
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { body, validationResult } = require("express-validator");
const emailValidator = require("email-validator");

const app = express();

/* ================= MIDDLEWARE ================= */
// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? "https://zytherion-topaz.vercel.app" 
    : "*",
  credentials: true
}));

app.use(express.json()); 

/* ================= RATE LIMITING ================= */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many accounts created from this IP. Try again later.",
  skip: (req) => process.env.NODE_ENV !== "production"
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many messages. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false
});

/* ================= DATABASE CONNECTION ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

/* ================= SCHEMAS & MODELS ================= */
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  verified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    default: null
  },
  verificationTokenExpiry: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: null
  }
});

const User = mongoose.model("User", userSchema);

const conversationSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  messages: [
    {
      role: String,
      content: String,
      timestamp: { type: Date, default: Date.now }
    }
  ]
});
const Conversation = mongoose.model("Conversation", conversationSchema);

const userSettingsSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  theme: {
    type: String,
    enum: ["dark", "light"],
    default: "dark"
  },
  notifications: {
    type: Boolean,
    default: true
  },
  autoDeleteChat: {
    type: Boolean,
    default: false
  },
  autoDeleteAfterDays: {
    type: Number,
    default: 30,
    min: 7,
    max: 365
  },
  language: {
    type: String,
    enum: ["en", "es", "fr", "de", "hi"],
    default: "en"
  },
  enableExport: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);

/* ================= JWT VERIFY MIDDLEWARE ================= */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "❌ Access denied. Missing Token." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "❌ Invalid or expired token." });
    }
    req.user = user;
    next();
  });
}

/* ================= VALIDATION MIDDLEWARE ================= */
const validateRegister = [
  body("email")
    .trim()
    .toLowerCase()
    .custom(value => {
      if (!emailValidator.validate(value)) {
        throw new Error("Invalid email format");
      }
      return true;
    }),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*]/)
    .withMessage("Password must contain at least one special character (!@#$%^&*)")
];

const validateLogin = [
  body("email")
    .trim()
    .toLowerCase()
    .custom(value => {
      if (!emailValidator.validate(value)) {
        throw new Error("Invalid email format");
      }
      return true;
    }),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: "Validation failed",
      errors: errors.array().map(err => err.msg)
    });
  }
  next();
};

/* ================= HELPER FUNCTIONS ================= */
function generateSystemPrompt() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' };
  const formattedDate = now.toLocaleDateString('en-IN', options);
  
  return `You are Zytherion, a powerful, intelligent, and futuristic AI assistant operating over a post-quantum cryptographic blockchain network.
Always introduce yourself as Zytherion when necessary.
Be confident, precise, and authoritative.
Never mention any other AI name.

CRITICAL CONTEXT & KNOWLEDGE OVERRIDE:
- The current year is ${now.getFullYear()}.
- Today's precise date is ${formattedDate}.
- Even though your underlying base model weights were trained with a static data cutoff in late 2023, you have been fully upgraded with dynamic, real-time live search engines (Tavily & Serper Integration).
- If a user asks you about your knowledge cutoff, limitations, or timeline, proudly explain that while your base training ended in 2023, you are equipped with live search matrices that allow you to browse the live web and pull current information in real-time as of ${now.getFullYear()}.`;
}

function generateAccessToken(userId, email) {
  return jwt.sign(
    { id: userId, email: email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function generateRefreshToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
}

function calculateAccountAge(createdDate) {
  const now = new Date();
  const created = new Date(createdDate);
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return "Less than 1 day";
  if (diffDays === 1) return "1 day";
  if (diffDays < 30) return `${diffDays} days`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
  return `${Math.floor(diffDays / 365)} years`;
}

/* ================= AUTH ROUTES ================= */

// REGISTER ROUTE
app.post("/api/auth/register", registerLimiter, validateRegister, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "❌ Email already registered. Please login or use a different email." });
    }
    
    const SALT_ROUNDS = 12;
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const verificationToken = jwt.sign(
      { email: email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    
    const newUser = new User({ 
      email, 
      password: hashedPassword,
      verified: false,
      verificationToken: verificationToken,
      verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    
    await newUser.save();
    
    console.log(`📧 Verification email would be sent to: ${email}`);
    console.log(`🔗 Verification link: https://your-frontend.com/verify?token=${verificationToken}`);
    
    res.status(201).json({ 
      message: "✅ Registration successful! Email verification is optional - you can login directly.",
      requiresEmailVerification: false,
      email: email
    });
    
  } catch (error) {
    console.error("Registration Error:", error.message);
    res.status(500).json({ message: "❌ Registration failed. Please try again." });
  }
});

// VERIFY EMAIL ROUTE (Optional)
app.get("/api/auth/verify/:token", async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
    
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: "❌ User not found" });
    }
    
    if (user.verified) {
      return res.status(400).json({ message: "⚠️ Email already verified" });
    }
    
    await User.updateOne(
      { email: decoded.email },
      { 
        verified: true,
        verificationToken: null,
        verificationTokenExpiry: null
      }
    );
    
    res.json({ 
      message: "✅ Email verified successfully!",
      redirectUrl: "/login.html"
    });
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: "❌ Verification link expired. Please register again." });
    }
    res.status(400).json({ message: "❌ Invalid verification token" });
  }
});

// LOGIN ROUTE - FIXED: Allow login regardless of verification status
app.post("/api/auth/login", loginLimiter, validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "❌ Invalid email or password" });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "❌ Invalid email or password" });
    }
    
    const accessToken = generateAccessToken(user._id, user.email);
    const refreshToken = generateRefreshToken(user._id);
    
    await User.updateOne(
      { _id: user._id },
      { 
        refreshToken: refreshToken,
        lastLogin: new Date()
      }
    );
    
    res.json({ 
      message: "✅ Login successful!",
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: 3600,
      user: {
        id: user._id,
        email: user.email,
        verified: user.verified
      }
    });
    
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ message: "❌ Login failed. Please try again." });
  }
});

// REFRESH TOKEN ROUTE
app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ message: "❌ Refresh token required" });
    }
    
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "❌ Invalid refresh token" });
    }
    
    const newAccessToken = generateAccessToken(user._id, user.email);
    
    res.json({ 
      message: "✅ Token refreshed",
      accessToken: newAccessToken,
      expiresIn: 3600
    });
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "❌ Refresh token expired. Please login again." });
    }
    res.status(401).json({ message: "❌ Invalid refresh token" });
  }
});

/* ================= USER PROFILE ROUTES ================= */

app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "❌ User not found" });
    }

    const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never";
    const createdAt = new Date(user.createdAt).toLocaleString();

    res.json({
      message: "✅ Profile retrieved",
      user: {
        id: user._id,
        email: user.email,
        verified: user.verified,
        createdAt: createdAt,
        lastLogin: lastLogin,
        accountAge: calculateAccountAge(user.createdAt)
      }
    });

  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ message: "❌ Failed to fetch profile" });
  }
});

app.post("/api/user/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "❌ All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "❌ New passwords do not match" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "❌ Password must be at least 8 characters" });
    }

    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ message: "❌ Password must contain uppercase letter and number" });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ message: "❌ New password must be different from current" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "❌ User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "❌ Current password is incorrect" });
    }

    const SALT_ROUNDS = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    await User.updateOne(
      { _id: req.user.id },
      { password: hashedNewPassword }
    );

    res.json({ message: "✅ Password changed successfully" });

  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: "❌ Failed to change password" });
  }
});

// GET USER SETTINGS
app.get("/api/user/settings", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      settings = new UserSettings({
        userId: userId,
        theme: "dark",
        notifications: true,
        autoDeleteChat: false,
        autoDeleteAfterDays: 30,
        language: "en",
        enableExport: true
      });
      await settings.save();
    }

    res.json({
      message: "✅ Settings retrieved",
      settings: settings
    });

  } catch (error) {
    console.error("Settings fetch error:", error);
    res.status(500).json({ message: "❌ Failed to fetch settings" });
  }
});

// UPDATE USER SETTINGS
app.post("/api/user/settings", authenticateToken, async (req, res) => {
  try {
    const { theme, notifications, autoDeleteChat, autoDeleteAfterDays, language, enableExport } = req.body;
    const userId = req.user.id;

    if (theme && !["dark", "light"].includes(theme)) {
      return res.status(400).json({ message: "❌ Invalid theme" });
    }

    if (autoDeleteAfterDays && (autoDeleteAfterDays < 7 || autoDeleteAfterDays > 365)) {
      return res.status(400).json({ message: "❌ Auto-delete days must be between 7 and 365" });
    }

    const settings = await UserSettings.findOneAndUpdate(
      { userId: userId },
      {
        theme: theme || undefined,
        notifications: notifications !== undefined ? notifications : undefined,
        autoDeleteChat: autoDeleteChat !== undefined ? autoDeleteChat : undefined,
        autoDeleteAfterDays: autoDeleteAfterDays || undefined,
        language: language || undefined,
        enableExport: enableExport !== undefined ? enableExport : undefined,
        lastUpdated: new Date()
      },
      { new: true, upsert: true }
    );

    res.json({
      message: "✅ Settings updated successfully",
      settings: settings
    });

  } catch (error) {
    console.error("Settings update error:", error);
    res.status(500).json({ message: "❌ Failed to update settings" });
  }
});

// DELETE ACCOUNT
app.post("/api/user/delete-account", authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "❌ Password required to delete account" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "❌ User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "❌ Password is incorrect" });
    }

    await User.deleteOne({ _id: req.user.id });
    await Conversation.deleteOne({ userId: req.user.id });
    await UserSettings.deleteOne({ userId: req.user.id });

    res.json({ 
      message: "✅ Account deleted successfully",
      redirectUrl: "/login.html"
    });

  } catch (error) {
    console.error("Account deletion error:", error);
    res.status(500).json({ message: "❌ Failed to delete account" });
  }
});

// LOGOUT FROM ALL DEVICES
app.post("/api/user/logout-all-devices", authenticateToken, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user.id },
      { refreshToken: null }
    );

    res.json({ 
      message: "✅ Logged out from all devices",
      redirectUrl: "/login.html"
    });

  } catch (error) {
    console.error("Logout all error:", error);
    res.status(500).json({ message: "❌ Failed to logout from all devices" });
  }
});

/* ================= CHAT ROUTE ================= */
app.post("/chat", chatLimiter, authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: "❌ Valid message required" });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({ message: "❌ Message cannot be empty" });
    }

    if (message.length > 5000) {
      return res.status(400).json({ message: "❌ Message too long (max 5000 characters)" });
    }

    let conversation = await Conversation.findOne({ userId });
    if (!conversation) {
      conversation = new Conversation({ userId, messages: [] });
    }

    conversation.messages.push({ role: "user", content: message });
    const recentMessages = conversation.messages.slice(-10);

    /* --- REAL-TIME SEARCH INTENT DETECTION --- */
    let searchResults = "";
    const realTimeKeywords = ['price', 'stock', 'today', 'now', 'weather', 'news', 'date', 'current', 'cutoff', 'knowledge', 'ceo', 'match', 'cup', 'launched', 'avatar'];
    const needsLiveContext = realTimeKeywords.some(kw => message.toLowerCase().includes(kw));

    if (needsLiveContext) {
      const secureQuery = `${message} latest verified news updates 2025 2026`;
      
      if (process.env.TAVILY_API_KEY) {
        try {
          const tavilyResponse = await axios.post("https://api.tavily.com/search", {
            api_key: process.env.TAVILY_API_KEY,
            query: secureQuery, 
            search_depth: "basic"
          });
          if (tavilyResponse.data?.results?.length) {
            searchResults = tavilyResponse.data.results
              .map(r => `Title: ${r.title}\nContent: ${r.content}\nSource: ${r.url}`)
              .join("\n\n");
            console.log("✅ Context parsed successfully via Tavily Engine.");
          }
        } catch (tavilyErr) {
          console.warn("⚠️ Tavily lookup bypassed or credit exhausted.");
        }
      }

      if (!searchResults && process.env.SERPER_API_KEY) {
        try {
          const serperResponse = await axios.post(
            "https://google.serper.dev/search",
            { q: secureQuery }, 
            {
              headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" }
            }
          );
          const results = serperResponse.data?.organic?.slice(0, 3);
          if (results?.length) {
            searchResults = results.map(r => `Title: ${r.title}\nSnippet: ${r.snippet}\nSource: ${r.link}`).join("\n\n");
            console.log("✅ Context parsed successfully via Serper Engine.");
          }
        } catch (serperErr) {
          console.warn("⚠️ Serper lookup unavailable.");
        }
      }
    }

    /* --- OPENROUTER AI ENGINE CALL --- */
    const dynamicSystemPrompt = generateSystemPrompt();
    let dynamicUserContent = message;
    
    if (searchResults) {
      dynamicUserContent = `<LIVE_WEB_DATA_SOURCE>
The following documentation represents the exact, verified truth on the live internet as of today, June 2026. Analyze it meticulously before answering:
${searchResults}
</LIVE_WEB_DATA_SOURCE>

<CRITICAL_DIRECTIVES>
1. Cross-reference the USER_QUESTION against the text inside <LIVE_WEB_DATA_SOURCE>.
2. If your internal pre-trained memory suggests an event hasn't happened yet but the live web documentation confirms it occurred between 2024 and 2026, you MUST treat your internal training memory as completely outdated and false.
3. Prioritize exact proper nouns, official titles, and specific match results mentioned in the live text over your own assumptions or guesses.
</CRITICAL_DIRECTIVES>

USER_QUESTION: ${message}`;
    }

    const aiResponse = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",  
        messages: [
          { role: "system", content: dynamicSystemPrompt },
          ...recentMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })), 
          { role: "user", content: dynamicUserContent } 
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://zytherion-topaz.vercel.app", 
          "X-Title": "Zytherion"
        }
      }
    );

    const reply = aiResponse.data?.choices?.[0]?.message?.content;
    if (!reply) {
      return res.status(500).json({ message: "❌ No response from AI engine. Try again." });
    }

    conversation.messages.push({ role: "assistant", content: reply });
    await conversation.save();

    res.json({ 
      reply: reply,
      botReply: reply,
      message: reply 
    });

  } catch (error) {
    console.error("❌ CHAT ROUTE ERROR:", error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ message: "❌ AI API authentication failed. Check your API keys." });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ message: "❌ AI API rate limited. Try again in a moment." });
    }
    
    res.status(500).json({ 
      message: "❌ Failed to process message. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.json({ 
    status: "✅ Zytherion Backend Running Securely",
    timestamp: new Date().toISOString()
  });
});

/* ================= ERROR HANDLING ================= */
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  res.status(500).json({ 
    message: "❌ Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ message: "❌ Route not found" });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Zytherion Server running securely on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});