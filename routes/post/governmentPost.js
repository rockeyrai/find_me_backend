const express = require('express');
const { pool } = require('../../config/db');
const { protect } = require('../../middlewares/authMiddleware');

const router = express.Router();

// Helper to ensure the secure table exists upon first access or handle separately
// In production, this would be part of migration scripts.
const ensureGovernmentTableExists = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS government_jobs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title text NOT NULL,
            description text,
            location geography(Point,4326) NOT NULL,
            radius_meters integer NOT NULL DEFAULT 5000,
            status text NOT NULL CHECK (status = ANY (ARRAY['active', 'resolved', 'cancelled'])),
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            security_clearance_level text
        );
        CREATE INDEX IF NOT EXISTS idx_gov_jobs_location ON government_jobs USING gist (location);
    `);
};

// Fetch highly secure government posts
router.get('/', protect, async (req, res) => {
    // Implement role check if applicable, e.g., if (req.user.role !== 'admin' && req.user.role !== 'government') return 403;
    try {
        await ensureGovernmentTableExists();
        
        const result = await pool.query(
            "SELECT * FROM government_jobs ORDER BY created_at DESC LIMIT 50"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Gov query error:", err);
        res.status(500).json({ error: 'Secure server error' });
    }
});

// Create a highly secure government post, stored in a separate database/table
router.post('/', protect, async (req, res) => {
    const { title, description, latitude, longitude, radius_meters, security_clearance_level } = req.body;
    
    // Additional security measure: log the attempt or check permissions here.
    
    if (!title || !latitude || !longitude || !radius_meters) {
        return res.status(400).json({ error: 'Missing required fields for government directive' });
    }

    try {
        await ensureGovernmentTableExists();

        // Parameterized query blocks SQL injection. Stored in specialized gov table.
        const query = `
            INSERT INTO government_jobs (
                title, description, location, radius_meters, status, created_by, security_clearance_level
            )
            VALUES (
                $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, 'active', $6, $7
            ) RETURNING *;
        `;
        
        const values = [
            title,
            description,
            longitude, 
            latitude,
            radius_meters,
            req.user.id,
            security_clearance_level || 'standard'
        ];

        const result = await pool.query(query, values);
        
        // Return minimal info to prevent data leaks or log to audit
        res.status(201).json({
            message: "Government directive recorded securely.",
            postId: result.rows[0].id
        });

    } catch (error) {
        console.error("Security Error creating gov post:", error);
        res.status(500).json({ error: 'Internal secure server error' });
    }
});

module.exports = router;
