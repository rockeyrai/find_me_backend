const express = require("express");
const { pool, withUserTransaction } = require("./db");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // Update to match your actual frontend URL config
    credentials: true,
}));

const client = new OAuth2Client(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/auth/callback` : 'http://localhost:3000/auth/callback' 
);

app.post('/api/auth/google', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: "Authorization code is required" });
    }

    try {
        // 1. Exchange the authorization code for tokens
        const { tokens } = await client.getToken(code);
        
        // 2. Verify the token with Google
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
        });
        const payload = ticket.getPayload(); // Contains email, name, sub (Google ID)
        const { email, name } = payload;

        // 3. Save/Update user in PostgreSQL within a transaction
        // Start without specifying a user since we might not know their ID yet
        const user = await withUserTransaction(null, async (db) => {
            // Upsert User: Save the "code" in the password row as requested
            const userResult = await db.query(
                `INSERT INTO users (email, password, role) 
                 VALUES ($1, $2, 'individual') 
                 ON CONFLICT (email) DO UPDATE SET password = $2
                 RETURNING id, email, role`,
                [email, code]
            );
            const userData = userResult.rows[0];

            // Inform the DB who the user is for this transaction to satisfy RLS policies
// userData.id is the UUID string
await db.query(`SET LOCAL "app.current_user" = '${userData.id}'`);
            // Upsert Profile data
            await db.query(
                `INSERT INTO profiles (user_id, full_name, updated_at) 
                 VALUES ($1, $2, NOW()) 
                 ON CONFLICT (user_id) DO UPDATE SET full_name = $2, updated_at = NOW()`,
                [userData.id, name]
            );

            return userData;
        });

        // 4. Create a session (JWT)
        const sessionToken = jwt.sign(
            { userId: user.id }, 
            process.env.JWT_SECRET || 'super-secret-key-change-me', 
            { expiresIn: '7d' }
        );

        // 5. Send as httpOnly cookie (Most Secure)
        res.cookie('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        }).json({ message: "Authenticated", user });

    } catch (error) {
        console.error("Google Auth Error Full:", error);
        res.status(401).json({ error: error.message || "Invalid Google Code or Server Error" });
    }
});

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
