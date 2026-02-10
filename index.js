import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50kb" })); // guardrail

const OFFICIAL_EMAIL = "tushar1425.be23@chitkara.edu.in";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ---------- helpers ----------
function ok(res, data) {
  return res.status(200).json({
    is_success: true,
    official_email: OFFICIAL_EMAIL,
    data,
  });
}

function okNoData(res) {
  return res.status(200).json({
    is_success: true,
    official_email: OFFICIAL_EMAIL,
  });
}

function badRequest(res, message) {
  return res.status(400).json({
    is_success: false,
    official_email: OFFICIAL_EMAIL,
    error: message,
  });
}

function serverError(res, message) {
  return res.status(500).json({
    is_success: false,
    official_email: OFFICIAL_EMAIL,
    error: message,
  });
}

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

// Fibonacci series up to n terms (as per example n=7 -> 7 numbers)
function fibonacciSeries(n) {
  const out = [];
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) {
    out.push(a);
    [a, b] = [b, a + b];
  }
  return out;
}

function isPrime(num) {
  if (!Number.isInteger(num) || num < 2) return false;
  if (num === 2) return true;
  if (num % 2 === 0) return false;
  for (let i = 3; i * i <= num; i += 2) {
    if (num % i === 0) return false;
  }
  return true;
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

function lcm2(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a / gcd(a, b) * b);
}

function lcmArray(arr) {
  return arr.reduce((acc, x) => lcm2(acc, x), 1);
}

function hcfArray(arr) {
  return arr.reduce((acc, x) => gcd(acc, x));
}

// External AI call (Gemini)
async function askGeminiOneWord(question) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const q = String(question || "").trim();
  if (!q) throw new Error("Empty AI question");

  const prompt =
    "Answer in exactly ONE WORD only. No punctuation. No extra text.\n" +
    "Question: " + q;

    const MODEL = "models/gemini-2.5-flash";  // must start with models/
    const url =
      `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${t}`);
  }

  const json = await resp.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return text.trim().split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, "");
}

  

// ---------- routes ----------
app.get("/health", (req, res) => {
  return okNoData(res);
});

app.post("/bfhl", async (req, res) => {
  try {
    // 1) Validate body is object
    if (!isPlainObject(req.body)) {
      return badRequest(res, "Request body must be a JSON object.");
    }

    // 2) Must contain exactly one key: fibonacci, prime, lcm, hcf, AI
    const keys = Object.keys(req.body);
    if (keys.length !== 1) {
      return badRequest(res, "Body must contain exactly one of: fibonacci, prime, lcm, hcf, AI");
    }

    const key = keys[0];
    const val = req.body[key];

    // 3) Route logic per key (as per PDF mapping)
    if (key === "fibonacci") {
      if (!Number.isInteger(val) || val < 0 || val > 1000) {
        return badRequest(res, "fibonacci must be an integer between 0 and 1000.");
      }
      return ok(res, fibonacciSeries(val));
    }

    if (key === "prime") {
      if (!Array.isArray(val) || val.length === 0 || val.length > 10000) {
        return badRequest(res, "prime must be a non-empty integer array (max 10000 length).");
      }
      if (!val.every(Number.isInteger)) {
        return badRequest(res, "prime array must contain only integers.");
      }
      const primes = val.filter(isPrime);
      return ok(res, primes);
    }

    if (key === "lcm") {
      if (!Array.isArray(val) || val.length === 0 || val.length > 10000) {
        return badRequest(res, "lcm must be a non-empty integer array (max 10000 length).");
      }
      if (!val.every(Number.isInteger)) {
        return badRequest(res, "lcm array must contain only integers.");
      }
      return ok(res, lcmArray(val));
    }

    if (key === "hcf") {
      if (!Array.isArray(val) || val.length === 0 || val.length > 10000) {
        return badRequest(res, "hcf must be a non-empty integer array (max 10000 length).");
      }
      if (!val.every(Number.isInteger)) {
        return badRequest(res, "hcf array must contain only integers.");
      }
      return ok(res, hcfArray(val));
    }

    if (key === "AI") {
      if (typeof val !== "string") {
        return badRequest(res, "AI must be a string question.");
      }
      try {
        const answer = await askGeminiOneWord(val);
        return ok(res, answer);
      } catch (e) {
        return serverError(res, `AI failed: ${e.message}`);
      }
    }

    return badRequest(res, "Invalid key. Use one of: fibonacci, prime, lcm, hcf, AI");
  } catch (e) {
    return serverError(res, "Unexpected server error.");
  }
});

// ---------- start ----------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
