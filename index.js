const express = require("express");
const pool = require("./db");

const app = express();
app.use(express.json());

// backend/server.js
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post('/api/auth/google', async (req, res) => {
    const { idToken } = req.body;

    try {
        // 1. Verify the token with Google
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload(); // Contains email, name, sub (Google ID)

        // 2. Save/Update user in PostgreSQL
        const { sub, email, name, picture } = payload;
        const user = await pool.query(
            `INSERT INTO users (google_id, email, name, avatar) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (google_id) DO UPDATE SET name = $3, avatar = $4
             RETURNING id, email`,
            [sub, email, name, picture]
        );

        // 3. Create a session (JWT)
        const sessionToken = jwt.sign({ userId: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // 4. Send as httpOnly cookie (Most Secure)
        res.cookie('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
        }).json({ message: "Authenticated", user: user.rows[0] });

    } catch (error) {
        res.status(401).send("Invalid Google Token");
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

app.listen(3000, () => {
  console.log("Server running on port 3000");
});