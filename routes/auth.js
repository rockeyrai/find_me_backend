// backend/routes/auth.js
app.post('/api/auth/google/verify', async (req, res) => {
  const { code } = req.body;

  // 1. Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code); 
  oauth2Client.setCredentials(tokens);

  // 2. Get User Info
  const googleUser = await google.oauth2('v2').userinfo.get({ auth: oauth2Client });
  
  // 3. Database Logic: The "upsert"
  const { id, email, name } = googleUser.data;
  const user = await db.query(
    `INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3)
     ON CONFLICT (google_id) DO UPDATE SET last_login = NOW()
     RETURNING id`, [id, email, name]
  );

  // 4. Issue a high-security cookie
  res.cookie('sid', encryptSession(user.rows[0].id), {
    httpOnly: true, // Prevents JS theft
    secure: true,   // Only over HTTPS
    sameSite: 'Strict', // Prevents CSRF
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  });

  res.status(200).send("Verified");
});