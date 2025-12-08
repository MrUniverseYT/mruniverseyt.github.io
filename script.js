// script.js

// Load codes.json and check if a code is valid & not expired
async function checkCodeValid(inputCode) {
  try {
    const res = await fetch("codes.json", { cache: "no-cache" });
    if (!res.ok) {
      console.error("Failed to load codes.json:", res.status);
      return { ok: false, reason: "server" };
    }

    const codes = await res.json();
    const now = Date.now();

    const entry = codes.find(c => c.code === inputCode);
    if (!entry) {
      return { ok: false, reason: "invalid" };
    }

    const exp = new Date(entry.expiresAt).getTime();
    if (isNaN(exp) || exp < now) {
      return { ok: false, reason: "expired" };
    }

    return { ok: true, entry };
  } catch (err) {
    console.error("Error checking code:", err);
    return { ok: false, reason: "network" };
  }
}

// Called on the Enter Code page
async function redeemCode() {
  const input = document.getElementById("codeInput");
  const code = (input.value || "").trim().toUpperCase();

  if (!code) {
    alert("Please enter a code.");
    return;
  }

  const result = await checkCodeValid(code);

  if (!result.ok) {
    if (result.reason === "invalid") {
      alert("Invalid code.");
    } else if (result.reason === "expired") {
      alert("That code has expired.");
    } else {
      alert("Could not check code. Try again later.");
    }
    return;
  }

  // Save access for this browser
  localStorage.setItem("accessExpiresAt", result.entry.expiresAt);
  localStorage.setItem("accessCodeUsed", code);

  // Redirect to games
  window.location.href = "games.html";
}

// Guard function to call on games / play pages
function requireAccess() {
  const expStr = localStorage.getItem("accessExpiresAt");
  if (!expStr) {
    window.location.href = "enter-code.html";
    return;
  }

  const exp = new Date(expStr);
  if (exp < new Date()) {
    // expired
    localStorage.removeItem("accessExpiresAt");
    localStorage.removeItem("accessCodeUsed");
    window.location.href = "enter-code.html?expired=1";
    return;
  }

  // still valid → do nothing, allow page
}
