const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
require("dotenv").config();

const app = express();

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));

// Routes
app.use('/api/auth', authRoutes);

// Health Check
app.get("/", async (req, res) => {
  const { pool } = require("./config/db");
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ message: "API is running", dbTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database connection error");
  }
});

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
