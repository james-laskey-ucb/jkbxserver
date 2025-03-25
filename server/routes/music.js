require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const pool = require("../db"); // PostgreSQL connection

router.post("/addSongListing", async (req, res) => {
    const { artist, song, album, vibe, release_year, uploaded_by } = req.body;

    if (!artist || !song || !album || !vibe || !release_year || !uploaded_by) {
        return res.status(400).json({ error: "All fields are required (artist, song, album, vibe, release_year, uploaded_by)" });
    }

    try {
        // Get the current song count to determine the new ID
        const countResult = await pool.query("SELECT COUNT(*) FROM songs");
        const newId = parseInt(countResult.rows[0].count) + 1; // Increment count for new ID

        const query = `
          INSERT INTO songs (id, artist, song, album, vibe, release_year, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
        `;

        const values = [newId, artist, song, album, vibe, release_year, uploaded_by];
        const result = await pool.query(query, values);

        res.status(201).json({ message: "Song added successfully", song: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});


router.post("/addSongsBatch", async (req, res) => {
    const songs = req.body.songs; // Expecting an array of song objects

    if (!Array.isArray(songs) || songs.length === 0) {
        return res.status(400).json({ error: "Songs must be an array with at least one song" });
    }

    try {
        // Get the current count of songs to determine the starting ID
        const countResult = await pool.query("SELECT COUNT(*) FROM songs");
        let newId = parseInt(countResult.rows[0].count) + 1; // Get the next available ID

        // Prepare query values
        const values = [];
        const placeholders = [];

        songs.forEach((song, index) => {
            const { artist, song: title, album, vibe, release_year, uploaded_by } = song;

            if (!artist || !title || !album || !vibe || !release_year || !uploaded_by) {
                throw new Error("All fields (artist, song, album, vibe, release_year, uploaded_by) are required for each song");
            }

            placeholders.push(`($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`);
            values.push(newId++, artist, title, album, vibe, release_year, uploaded_by);
        });

        const query = `
          INSERT INTO songs (id, artist, song, album, vibe, release_year, uploaded_by)
          VALUES ${placeholders.join(", ")}
          RETURNING *;
        `;

        const result = await pool.query(query, values);
        res.status(201).json({ message: "Songs added successfully", songs: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/searchSongs", async (req, res) => {
    try {
        const { artist, song, album, vibe, page = 1, limit = 10, sort = "relevance" } = req.query;

        // Convert pagination values to integers
        const pageNumber = parseInt(page, 10) || 1;
        const limitNumber = parseInt(limit, 10) || 10;
        const offset = (pageNumber - 1) * limitNumber;

        // Base query
        let query = "SELECT *, ";
        let relevanceScore = [];

        const values = [];
        let index = 1;

        // Dynamically build WHERE conditions and relevance score
        if (artist) {
            query += ` CASE WHEN artist ILIKE $${index} THEN 2 ELSE 0 END +`;
            relevanceScore.push(2);
            values.push(`%${artist}%`);
            index++;
        }
        if (song) {
            query += ` CASE WHEN song ILIKE $${index} THEN 3 ELSE 0 END +`;
            relevanceScore.push(3);
            values.push(`%${song}%`);
            index++;
        }
        if (album) {
            query += ` CASE WHEN album ILIKE $${index} THEN 1 ELSE 0 END +`;
            relevanceScore.push(1);
            values.push(`%${album}%`);
            index++;
        }
        if (vibe) {
            query += ` CASE WHEN vibe ILIKE $${index} THEN 2 ELSE 0 END +`;
            relevanceScore.push(2);
            values.push(`%${vibe}%`);
            index++;
        }

        // Remove trailing `+` if relevance score exists
        if (relevanceScore.length > 0) {
            query = query.slice(0, -1);
        } else {
            query += " 0"; // Default relevance score if no filters
        }

        query += ` AS relevance FROM songs WHERE 1=1`;

        // Append WHERE clauses
        if (artist) query += ` AND artist ILIKE $${values.indexOf(`%${artist}%`) + 1}`;
        if (song) query += ` AND song ILIKE $${values.indexOf(`%${song}%`) + 1}`;
        if (album) query += ` AND album ILIKE $${values.indexOf(`%${album}%`) + 1}`;
        if (vibe) query += ` AND vibe ILIKE $${values.indexOf(`%${vibe}%`) + 1}`;

        // Sorting logic
        if (sort === "relevance" && relevanceScore.length > 0) {
            query += " ORDER BY relevance DESC";
        } else {
            query += " ORDER BY song ASC"; // Default sorting by song name
        }

        query += ` LIMIT $${index} OFFSET $${index + 1}`;
        values.push(limitNumber, offset);

        // Execute query
        const result = await pool.query(query, values);
        res.status(200).json({
            page: pageNumber,
            limit: limitNumber,
            totalResults: result.rows.length,
            songs: result.rows
        });

    } catch (err) {
        console.error("Error searching songs:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

module.exports = router;