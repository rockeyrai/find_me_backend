const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

const protect = async (req, res, next) => {
    const token = req.cookies.session;

    if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-change-me');
        
        // Fetch full user data to ensure they still exist and sync latest role
        const result = await pool.query(
            "SELECT id, email, role FROM users WHERE id = $1",
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            // User was deleted but cookie still exists
             res.clearCookie('session');
             return res.status(401).json({ error: "User no longer exists" });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        console.error("Auth middleware error:", error.message);
        res.clearCookie('session');
        res.status(401).json({ error: "Invalid or expired session" });
    }
};

module.exports = { protect };
