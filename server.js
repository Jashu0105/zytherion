/* ================= IMPORTS & SETUP ================= */
require("dotenv").config(); // Essential Line 1: Loads variables immediately
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors()); 
app.use(express.json()); 

/* ================= DATABASE CONNECTION ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

/* ================= SCHEMAS & MODELS ================= */
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
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

/* ================= JWT VERIFY MIDDLEWARE ================= */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access denied" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

/* ================= HELPER FUNCTIONS ================= */
// Structures temporal rules so Zytherion never gets stuck in the past
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
/* ================= AUTH ROUTES ================= */

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    console.log("REGISTER REQUEST:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    
    console.log("USER CREATED:", email);
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Registration error", error: error.message });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Login error" });
  }
});

/* ================= CHAT ROUTE ================= */

app.post("/chat", authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ reply: "Message required." });
    }

    let conversation = await Conversation.findOne({ userId });
    if (!conversation) {
      conversation = new Conversation({ userId, messages: [] });
    }

    conversation.messages.push({ role: "user", content: message });
    const recentMessages = conversation.messages.slice(-10);

   /* --- REAL-TIME SEARCH INTENT DETECTION (TAVILY W/ SERPER FAILOVER) --- */
    let searchResults = "";
    const realTimeKeywords = ['price', 'stock', 'today', 'now', 'weather', 'news', 'date', 'current'];
    const needsLiveContext = realTimeKeywords.some(kw => message.toLowerCase().includes(kw));

    console.log("--- START MULTI-ENGINE SEARCH DEBUG ---");
    
    if (needsLiveContext) {
      
      // ==========================================
      // PLACE IT HERE: Create the filtered query string
      // ==========================================
      const secureQuery = `${message} latest news official 2025 2026`;
      console.log(`Optimizing search matrix query parameters: "${secureQuery}"`);

      // Strategy A: Attempt high-priority Tavily optimization first
      if (process.env.TAVILY_API_KEY) {
        console.log("Live intent detected. Attempting primary engine [Tavily]...");
        try {
          const tavilyResponse = await axios.post("https://api.tavily.com/search", {
            api_key: process.env.TAVILY_API_KEY,
            query: secureQuery, // <-- CHANGE THIS from 'message' to 'secureQuery'
            search_depth: "basic"
          });
          
          if (tavilyResponse.data?.results?.length) {
            searchResults = tavilyResponse.data.results
              .map(r => `Title: ${r.title}\nContent: ${r.content}\nSource: ${r.url}`)
              .join("\n\n");
            console.log("Context successfully structured via primary Tavily layer.");
          }
        } catch (tavilyErr) {
          console.warn("Primary Tavily layer failed or credit depleted. Falling back to Serper...", tavilyErr.message);
        }
      }

      // Strategy B: Fallback/Alternative execution via Serper if Tavily missed or errored out
      if (!searchResults && process.env.SERPER_API_KEY) {
        console.log("Attempting secondary engine [Serper/Google]...");
        try {
          const serperResponse = await axios.post(
            "https://google.serper.dev/search",
            { q: secureQuery }, // <-- CHANGE THIS from 'message' to 'secureQuery'
            {
              headers: {
                "X-API-KEY": process.env.SERPER_API_KEY,
                "Content-Type": "application/json"
              }
            }
          );

          const results = serperResponse.data?.organic?.slice(0, 3);
          if (results?.length) {
            searchResults = results.map(r =>
              `Title: ${r.title}\nSnippet: ${r.snippet}\nSource: ${r.link}`
            ).join("\n\n");
            console.log("Context successfully recovered via backup Serper engine.");
          }
        } catch (serperErr) {
          console.error("Secondary search engine failed as well:", serperErr.message);
        }
      }
      
      if (!searchResults) {
        console.log("Search keys exist but both external engines returned null or failed.");
      }
    } else {
      console.log("Static prompt structure parsed. API lookup skipped to optimize server resources.");
    }
    console.log("--- END MULTI-ENGINE SEARCH DEBUG ---");

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
          "HTTP-Referer": "https://zytherionai-topaz.vercel.app", 
          "X-Title": "Zytherion"
        }
      }
    ); // <-- This is where the closing formatting got messed up!

    const reply = aiResponse.data?.choices?.[0]?.message?.content || "No response from AI.";

    conversation.messages.push({ role: "assistant", content: reply });
    await conversation.save();

    res.json({ reply });

  } catch (error) {
    console.error("FULL ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});
/* ================= HEALTH LAYER ================= */
app.get("/", (req, res) => {
  res.send("Zytherion Backend Running Securely");
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
});