const express = require('express');
const { pool } = require('../../config/db');
const { protect } = require('../../middlewares/authMiddleware');

const router = express.Router();

// Fetch all normally posted jobs
router.get('/jobs', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM jobs WHERE job_type = 'job' OR job_type IS NULL ORDER BY created_at DESC LIMIT 50"
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching jobs' });
    }
});

// Fetch events
router.get('/events', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM jobs WHERE job_type = 'event' ORDER BY created_at DESC LIMIT 50"
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching events' });
    }
});

// Fetch volunteers
router.get('/volunteers', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM jobs WHERE job_type = 'volunteer' ORDER BY created_at DESC LIMIT 50"
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching volunteers' });
    }
});

// Create a normal post
router.post('/', protect, async (req, res) => {
    const { title, description, latitude, longitude, radius_meters, job_type } = req.body;
    
    // Ensure it's not trying to create a government post here
    if (job_type === 'government') {
        return res.status(403).json({ error: 'Use the secure endpoint for government directives' });
    }

    if (!title || !latitude || !longitude || !radius_meters) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const query = `
            INSERT INTO jobs (
                id, title, description, location, radius_meters, status, created_by, job_type
            )
            VALUES (
                gen_random_uuid(), $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, 'open', $6, $7
            ) RETURNING *;
        `;
        
        const values = [
            title,
            description,
            longitude, // Note: PostGIS is Longitude, Latitude
            latitude,
            radius_meters,
            req.user.id,
            job_type || 'job'
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
