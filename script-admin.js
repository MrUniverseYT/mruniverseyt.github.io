async function generateCode() {
  const res = await fetch("/admin/generate", { method: "POST" });
  const data = await res.json();

  document.getElementById("generated").textContent =
    "Generated Code: " + data.code;

  loadCodes();
}

async function loadCodes() {
  console.log("Loading codes...");
  const res = await fetch("/admin/codes");
  const codes = await res.json();
  console.log("Got codes:", codes);

  const tbody = document.querySelector("#codeTable tbody");
  tbody.innerHTML = "";

  codes.forEach((code) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${code.code}</td>
      <td>${code.activatedAt ? new Date(code.activatedAt).toLocaleString() : "Not used"}</td>
      <td>${code.expiresAt ? new Date(code.expiresAt).toLocaleString() : "Not set"}</td>
      <td>
        <button onclick="setExpiry('${code.code}')">Set Expiry</button>
        <button onclick="deleteCode('${code.code}')">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

async function deleteCode(code) {
  await fetch("/admin/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  loadCodes();
}

async function setExpiry(code) {
  console.log("Clicked Set Expiry for:", code);

  const daysStr = prompt(
    "How many days from NOW should this code stay active? (e.g. 3)",
    "3"
  );

  if (!daysStr) {
    console.log("Set Expiry cancelled");
    return;
  }

  const days = parseInt(daysStr, 10);
  if (isNaN(days) || days <= 0) {
    alert("Please enter a valid positive number of days.");
    return;
  }

  const res = await fetch("/admin/set-expiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, days }),
  });

  const data = await res.json();
  console.log("Set-expiry response:", data);

  if (!data.success) {
    alert("Error: " + data.message);
  } else {
    alert("New expiry set to: " + new Date(data.expiresAt).toLocaleString());
  }

  loadCodes(); // refresh table
}


// Load codes immediately when admin page opens
loadCodes();
