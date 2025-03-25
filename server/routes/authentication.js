require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const pool = require("../db"); // PostgreSQL connection

const router = express.Router();

// Secret Key for JWT
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

// Create Account Route
router.post(
    "/createAccount",
    [
        body("username").isString().notEmpty(),
        body("password").isLength({ min: 6 }),
        body("email").isEmail(),
        body("phone").isMobilePhone(),
        body("age").isInt({ min: 13 }) // Minimum age requirement
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const uid = crypto.randomUUID();
        console.log(uid);
        console.log(req.body)
        const { username, password, email, phone, age } = req.body;

        try {
            // Check if user already exists
            const userExists = await pool.query("SELECT * FROM jkbxdev.users WHERE email = $1 OR phone = $2", [email, phone]);
            if (userExists.rows.length > 0) {
                return res.status(400).json({ error: "User already exists" });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert into database
            const newUser = await pool.query(
                "INSERT INTO jkbxdev.users (uid, username, password, email, phone, age) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
                [uid,username, String(hashedPassword), email, phone, age]
            );

            res.status(201).json({ message: "Account created successfully", user: newUser.rows[0] });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Server error" });
        }
    }
);

// Login Route
router.post(
    "/login",
    [
        body("username").isString().notEmpty(),
        body("password").isString().notEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            // Find user
            const user = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
            if (user.rows.length === 0) {
                return res.status(400).json({ error: "Invalid username or password" });
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.rows[0].password);
            if (!isMatch) {
                return res.status(400).json({ error: "Invalid username or password" });
            }

            // Generate JWT token
            const token = jwt.sign({ id: user.rows[0].id }, JWT_SECRET, { expiresIn: "1h" });

            res.json({ message: "Login successful", token });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Server error" });
        }
    }
);

module.exports = router;
