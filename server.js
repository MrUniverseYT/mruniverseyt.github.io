const express = require("express");
const session = require("express-session");
const { Sequelize, DataTypes } = require("sequelize");

// CHANGE THIS PASSWORD IF YOU WANT
const ADMIN_PASSWORD = "ifyouarentmeyouadmit-you-suck";

const app = express();

// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// ---------- DATABASE ----------
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "database.sqlite",
});

const AccessCode = sequelize.define("AccessCode", {
  code: { type: DataTypes.STRING, unique: true },
  activatedAt: { type: DataTypes.DATE, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  used: { type: DataTypes.BOOLEAN, defaultValue: false },
});

sequelize.sync();

// ---------- HELPERS ----------
function adminOnly(req, res, next) {
  if (req.session.admin === true) return next();
  return res.status(403).send("Not authorized");
}

function checkAccess(req, res, next) {
  const expires = req.session.expiresAt;
  if (!expires) return res.redirect("/enter-code.html");

  if (new Date(expires) < new Date()) {
    return res.redirect("/enter-code.html?expired=true");
  }

  next();
}

function makeCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let c = "";
  for (let i = 0; i < 12; i++)
    c += chars[Math.floor(Math.random() * chars.length)];
  return c.match(/.{1,4}/g).join("-");
}

// ---------- REDEEM (user enters code) ----------
app.post("/redeem", async (req, res) => {
  const { code } = req.body;
  const entry = await AccessCode.findOne({ where: { code } });

  if (!entry)
    return res.json({ success: false, message: "Invalid code" });

  const now = new Date();

  // First time use → give 3 days
  if (!entry.used) {
    entry.used = true;
    entry.activatedAt = now;
    entry.expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    await entry.save();

    req.session.expiresAt = entry.expiresAt;
    return res.json({ success: true, message: "Access granted!" });
  }

  // Already used → still valid?
  if (entry.expiresAt > now) {
    req.session.expiresAt = entry.expiresAt;
    return res.json({ success: true, message: "Access active!" });
  }

  return res.json({ success: false, message: "Code expired" });
});

// ---------- ADMIN LOGIN ----------
app.get("/admin-login", (req, res) => {
  const { pass } = req.query;
  if (pass === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.redirect("/admin.html");
  }
  res.send("Invalid password");
});

// ---------- ADMIN: Generate Code ----------
app.post("/admin/generate", adminOnly, async (req, res) => {
  const code = makeCode();
  await AccessCode.create({ code });
  res.json({ code });
});

// ---------- ADMIN: List Codes ----------
app.get("/admin/codes", adminOnly, async (req, res) => {
  const codes = await AccessCode.findAll({
    order: [["createdAt", "DESC"]],
  });
  res.json(codes);
});

// ---------- ADMIN: Delete Code ----------
app.post("/admin/delete", adminOnly, async (req, res) => {
  const { code } = req.body;
  await AccessCode.destroy({ where: { code } });
  res.json({ success: true });
});

// ---------- ADMIN: Set Expiry (days from now) ----------
app.post("/admin/set-expiry", adminOnly, async (req, res) => {
  try {
    const { code, days } = req.body;
    console.log("SET EXPIRY called with:", code, days);

    if (!code || days == null) {
      return res.json({
        success: false,
        message: "Code and days are required",
      });
    }

    const entry = await AccessCode.findOne({ where: { code } });
    if (!entry) {
      return res.json({ success: false, message: "Code not found" });
    }

    const now = new Date();
    const daysNumber = Number(days);
    if (isNaN(daysNumber) || daysNumber <= 0) {
      return res.json({
        success: false,
        message: "Days must be a positive number",
      });
    }

    const expiresAt = new Date(
      now.getTime() + daysNumber * 24 * 60 * 60 * 1000
    );

    if (!entry.used) {
      entry.used = true;
      entry.activatedAt = now;
    }

    entry.expiresAt = expiresAt;
    await entry.save();

    console.log("Updated expiry for", code, "to", expiresAt);
    res.json({ success: true, expiresAt });
  } catch (err) {
    console.error("Error in /admin/set-expiry:", err);
    res.json({ success: false, message: "Server error setting expiry" });
  }
});

// ---------- PROTECTED GAMES PAGE ----------
app.get("/games.html", checkAccess, (req, res) => {
  res.sendFile(__dirname + "/public/games.html");
});


// ---------- START ----------
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
