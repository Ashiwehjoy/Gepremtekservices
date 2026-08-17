const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database
const db = new Database("royal-klin.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Serve website files
app.use(express.static(path.join(__dirname)));

// Customer booking
app.post("/api/bookings", (req, res) => {
  try {
    const data = req.body || {};

    const result = db.prepare(`
      INSERT INTO bookings (data, status)
      VALUES (?, 'Pending')
    `).run(JSON.stringify(data));

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: "Booking saved successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Unable to save booking"
    });
  }
});

// Basic authentication for admin
function adminAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Royal-Klin Admin"');
    return res.status(401).send("Authentication required");
  }

  const encoded = header.slice(6);

  let decoded;

  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return res.status(401).send("Invalid authentication");
  }

  const separator = decoded.indexOf(":");

  if (separator === -1) {
    return res.status(401).send("Invalid authentication");
  }

  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  if (user !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="Royal-Klin Admin"');
    return res.status(401).send("Invalid username or password");
  }

  next();
}

// Get all bookings
app.get("/api/admin/bookings", adminAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, data, status, created_at
      FROM bookings
      ORDER BY id DESC
    `).all();

    const bookings = rows.map(row => {
      let data = {};

      try {
        data = JSON.parse(row.data);
      } catch {
        data = {};
      }

      return {
        id: row.id,
        ...data,
        status: row.status,
        created_at: row.created_at
      };
    });

    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Unable to load bookings"
    });
  }
});

// Update booking status
app.patch("/api/admin/bookings/:id", adminAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body.status;

    const allowedStatuses = [
      "Pending",
      "Processing",
      "Ready",
      "Delivered",
      "Cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid booking status"
      });
    }

    const result = db.prepare(`
      UPDATE bookings
      SET status = ?
      WHERE id = ?
    `).run(status, id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Booking not found"
      });
    }

    res.json({
      success: true,
      message: "Booking status updated"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Unable to update booking"
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Royal-Klin Laundry"
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Royal-Klin server running on port ${PORT}`);
});
