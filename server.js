const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const { createServer } = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const httpServer = createServer(app);

// Configure CORS for frontend on Netlify
const allowedOrigins = [
    'https://auma.github.io',
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
});

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
    secret: process.env.SESSION_SECRET || "vrfs-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// Database files
const USERS_DB = path.join(__dirname, "users.json");
const CHAT_DB = path.join(__dirname, "chat.json");

// Initialize databases
if (!fs.existsSync(USERS_DB)) {
    fs.writeFileSync(USERS_DB, JSON.stringify({}));
}
if (!fs.existsSync(CHAT_DB)) {
    fs.writeFileSync(CHAT_DB, JSON.stringify([]));
}

// Helper functions
function getUsers() {
    return JSON.parse(fs.readFileSync(USERS_DB));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2));
}

function getChatHistory() {
    return JSON.parse(fs.readFileSync(CHAT_DB));
}

function saveChatHistory(messages) {
    // Keep last 100 messages
    const trimmed = messages.slice(-100);
    fs.writeFileSync(CHAT_DB, JSON.stringify(trimmed, null, 2));
}

async function getCountryFromIP(ip) {
    try {
        // Handle localhost/127.0.0.1
        if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
            return 'Localhost';
        }
        
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.country) {
            return data.country;
        } else {
            console.log('IP geolocation failed:', data);
            return 'Unknown';
        }
    } catch (err) {
        console.error('Error getting country from IP:', err);
        return 'Unknown';
    }
}

// VRFS API
app.get("/vrfs", async (req, res) => {
    const uid = req.query.uid;
    if (!uid) return res.status(400).send("Missing uid");

    try {
        const vrfsRes = await fetch(
            `https://api.vrfs.gg/webhooks/v1/get_username.php?uid=${uid}`
        );

        if (!vrfsRes.ok) {
            return res.status(500).send("VRFS API error: " + vrfsRes.status);
        }

        const text = await vrfsRes.text();
        res.send(text.trim());
    } catch (err) {
        res.status(500).send("Server error: " + err.message);
    }
});

// Register
app.post("/register", async (req, res) => {
    const { uid, password, username } = req.body;
    
    if (!uid || !password || !username) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const users = getUsers();
    if (users[uid]) {
        return res.status(400).json({ error: "UID already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const country = await getCountryFromIP(req.ip);
    
    users[uid] = {
        uid,
        password: hashedPassword,
        username,
        verified: false,
        createdAt: new Date().toISOString(),
        country: country,
        online: false
    };
    
    saveUsers(users);
    req.session.uid = uid;
    req.session.username = username;
    
    res.json({ success: true, uid, username });
});

// Login
app.post("/login", async (req, res) => {
    const { uid, password } = req.body;
    
    if (!uid || !password) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const users = getUsers();
    const user = users[uid];
    
    if (!user) {
        return res.status(400).json({ error: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return res.status(400).json({ error: "Invalid password" });
    }

    req.session.uid = uid;
    req.session.username = user.username;
    
    res.json({ success: true, uid, username: user.username, verified: user.verified });
});

// Verify username
app.post("/verify", async (req, res) => {
    if (!req.session.uid) {
        return res.status(401).json({ error: "Not logged in" });
    }

    const users = getUsers();
    const user = users[req.session.uid];
    
    // Check if already verified
    if (user && user.verified) {
        return res.json({ success: true, alreadyVerified: true, username: "Already verified" });
    }

    const { expectedName } = req.body;
    
    try {
        const vrfsRes = await fetch(
            `https://api.vrfs.gg/webhooks/v1/get_username.php?uid=${req.session.uid}`
        );

        if (!vrfsRes.ok) {
            return res.status(500).json({ error: "VRFS API error" });
        }

        const username = (await vrfsRes.text()).trim();
        
        if (username === expectedName) {
            users[req.session.uid].verified = true;
            users[req.session.uid].verifiedAt = new Date().toISOString();
            saveUsers(users);
            res.json({ success: true, username });
        } else {
            res.json({ success: false, currentUsername: username });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Get current user
app.get("/me", (req, res) => {
    if (!req.session.uid) {
        return res.status(401).json({ error: "Not logged in" });
    }

    const users = getUsers();
    const user = users[req.session.uid];
    
    res.json({
        uid: user.uid,
        username: user.username,
        verified: user.verified
    });
});

// Get user profile
app.get("/profile/:uid", (req, res) => {
    const users = getUsers();
    const user = users[req.params.uid];
    
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    res.json({
        uid: user.uid,
        username: user.username,
        verified: user.verified,
        createdAt: user.createdAt,
        avatar: `https://userpic.vrfs.org/avatar/avatar-pics/${user.uid}.png`,
        country: user.country || 'Unknown',
        online: user.online || false,
        lastSeen: user.lastSeen
    });
});

// Get chat history
app.get("/chat/history", (req, res) => {
    res.json(getChatHistory());
});

// Logout
app.post("/logout", (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get users list with online status
app.get("/users", (req, res) => {
    const users = getUsers();
    const usersList = Object.values(users).map(user => ({
        uid: user.uid,
        username: user.username,
        verified: user.verified,
        avatar: `https://userpic.vrfs.org/avatar/avatar-pics/${user.uid}.png`,
        online: user.online || false,
        lastSeen: user.lastSeen,
        country: user.country || 'Unknown'
    }));
    res.json(usersList);
});

// WebSocket for chat
io.on("connection", (socket) => {
    socket.on("join", (uid) => {
        socket.uid = uid;
        socket.join("chat");
        
        // Mark user as online
        const users = getUsers();
        if (users[uid]) {
            users[uid].online = true;
            users[uid].lastSeen = new Date().toISOString();
            saveUsers(users);
        }
        
        // Broadcast user came online
        io.to("chat").emit("userStatus", { uid, online: true });
        
        // Send current online users to the new user
        const onlineUsers = Object.values(users).filter(u => u.online && u.verified);
        socket.emit("onlineUsers", onlineUsers);
    });

    socket.on("message", (data) => {
        const users = getUsers();
        const user = users[data.uid];
        
        if (!user || !user.verified) {
            return;
        }

        const message = {
            uid: data.uid,
            username: user.username,
            avatar: `https://userpic.vrfs.org/avatar/avatar-pics/${data.uid}.png`,
            text: data.text,
            timestamp: new Date().toISOString()
        };

        const history = getChatHistory();
        history.push(message);
        saveChatHistory(history);

        io.to("chat").emit("message", message);
    });

    socket.on("disconnect", () => {
        if (socket.uid) {
            const users = getUsers();
            if (users[socket.uid]) {
                users[socket.uid].online = false;
                users[socket.uid].lastSeen = new Date().toISOString();
                saveUsers(users);
            }
            
            // Broadcast user went offline
            io.to("chat").emit("userStatus", { uid: socket.uid, online: false });
        }
        socket.leave("chat");
    });
});

// Fallback route
app.get("/verify.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "verify.html"));
});

httpServer.listen(process.env.PORT || 3000, () => {
    console.log("VRFS verifier running on port", process.env.PORT || 3000);
});
