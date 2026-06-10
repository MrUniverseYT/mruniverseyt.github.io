const express = require("express");
const session = require("express-session");
const { Sequelize, DataTypes } = require("sequelize");
const fs = require("fs");
const path = require("path");

const ADMIN_PASSWORD = "ifyouarentmeyouadmit-you-suck";

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.use(
  session({
    secret: "arghosting-secret-2024",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: "auto" }
  })
);

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

app.post("/redeem", async (req, res) => {
  const { code } = req.body;
  const entry = await AccessCode.findOne({ where: { code } });

  if (!entry)
    return res.json({ success: false, message: "Invalid code" });

  const now = new Date();

  if (!entry.used) {
    entry.used = true;
    entry.activatedAt = now;
    entry.expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    await entry.save();
    req.session.expiresAt = entry.expiresAt;
    return res.json({ success: true, message: "Access granted!" });
  }

  if (entry.expiresAt > now) {
    req.session.expiresAt = entry.expiresAt;
    return res.json({ success: true, message: "Access active!" });
  }

  return res.json({ success: false, message: "Code expired" });
});

app.get("/admin-login", (req, res) => {
  const { pass } = req.query;
  if (pass === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.redirect("/admin.html");
  }
  res.send("Invalid password");
});

app.post("/admin/generate", adminOnly, async (req, res) => {
  const code = makeCode();
  await AccessCode.create({ code });
  res.json({ code });
});

app.get("/admin/codes", adminOnly, async (req, res) => {
  const codes = await AccessCode.findAll({ order: [["createdAt", "DESC"]] });
  res.json(codes);
});

app.post("/admin/delete", adminOnly, async (req, res) => {
  const { code } = req.body;
  await AccessCode.destroy({ where: { code } });
  res.json({ success: true });
});

app.post("/admin/set-expiry", adminOnly, async (req, res) => {
  try {
    const { code, days } = req.body;
    if (!code || days == null)
      return res.json({ success: false, message: "Code and days are required" });

    const entry = await AccessCode.findOne({ where: { code } });
    if (!entry)
      return res.json({ success: false, message: "Code not found" });

    const now = new Date();
    const daysNumber = Number(days);
    if (isNaN(daysNumber) || daysNumber <= 0)
      return res.json({ success: false, message: "Days must be a positive number" });

    const expiresAt = new Date(now.getTime() + daysNumber * 24 * 60 * 60 * 1000);
    if (!entry.used) {
      entry.used = true;
      entry.activatedAt = now;
    }
    entry.expiresAt = expiresAt;
    await entry.save();
    res.json({ success: true, expiresAt });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error setting expiry" });
  }
});

app.get("/games.html", checkAccess, (req, res) => {
  res.sendFile(__dirname + "/games.html");
});

// ---------- DEBUG REPORTS ----------
app.post("/debug-report", (req, res) => {
  try {
    const reportsDir = path.join(__dirname, "reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

    const report = {
      receivedAt: new Date().toISOString(),
      ...req.body,
    };

    const filename = `report-${Date.now()}.json`;
    fs.writeFileSync(path.join(reportsDir, filename), JSON.stringify(report, null, 2));
    console.log(`Debug report saved: ${filename}`);
    res.json({ success: true, message: "Report received" });
  } catch (err) {
    console.error("Debug report error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- VIEW REPORTS ----------
app.get("/admin/reports", adminOnly, (req, res) => {
  try {
    const reportsDir = path.join(__dirname, "reports");
    if (!fs.existsSync(reportsDir)) return res.json([]);

    const files = fs.readdirSync(reportsDir).reverse();
    const reports = files.reduce((acc, f) => {
      try {
        const content = fs.readFileSync(path.join(reportsDir, f), "utf8");
        acc.push(JSON.parse(content));
      } catch (e) {
        console.warn(`Skipping bad report file: ${f}`);
      }
      return acc;
    }, []);

    res.json(reports);
  } catch (err) {
    console.error("Error reading reports:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- START ----------
const reportsDir = path.join(__dirname, "reports");
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
