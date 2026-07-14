// api/analyze.js — the AI scam-check engine:
//   1. OCR any uploaded screenshots (GPT-4o-mini vision)
//   2. Structured triage → verdict, risk, plain-English report (GPT-4o-mini)
//   3. Gemini web-research corroboration of extracted numbers/links/emails
// Idempotent: safe to call twice for the same submission.
import { notifyKieran } from "./_notify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) {
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }
  const sb = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

  try {
    const { submission_id } = req.body || {};
    if (!submission_id) return res.status(400).json({ ok: false, error: "submission_id required" });

    const existRes = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_reports?submission_id=eq.${encodeURIComponent(submission_id)}&select=id&limit=1`,
      { headers: sb }
    );
    if (existRes.ok && (await existRes.json()).length > 0) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/submissions?id=eq.${encodeURIComponent(submission_id)}&limit=1`,
      { headers: { ...sb, Accept: "application/vnd.pgrst.object+json" } }
    );
    if (!subRes.ok) return res.status(404).json({ ok: false, error: "Submission not found" });
    const sub = await subRes.json();

    await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${sub.id}`, {
      method: "PATCH",
      headers: sb,
      body: JSON.stringify({ status: "analyzing" }),
    });

    /* ── 1. OCR screenshots (up to 3) ─────────────────────────────── */
    let ocrText = "";
    const paths = Array.isArray(sub.image_paths) ? sub.image_paths.slice(0, 3) : [];
    for (const p of paths) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/uploads/${p}`;
      try {
        const ocrRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 2000,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract all readable text from this screenshot or photo exactly as written — including sender names/numbers, URLs, reference numbers and fine print. Return only the extracted text, no commentary.",
                  },
                  { type: "image_url", image_url: { url: publicUrl } },
                ],
              },
            ],
          }),
        });
        if (ocrRes.ok) {
          const d = await ocrRes.json();
          const t = d.choices?.[0]?.message?.content?.trim();
          if (t) ocrText += (ocrText ? "\n---\n" : "") + t;
        }
      } catch (e) {
        console.error("[analyze] OCR error (non-blocking):", e.message || e);
      }
    }

    /* ── 2. Structured triage ─────────────────────────────────────── */
    const systemPrompt = `You are the analysis engine for "Second Look Protect", a UK service where worried members of the public send in suspicious messages, emails, calls, letters and websites for a calm second opinion before they act. A human expert (Kieran) reviews and approves every report before it is sent.

Rules:
- You are advisory; a human reviews everything. Never claim certainty you don't have.
- Ground every claim in the submitted details and any extracted screenshot text. Do not invent facts.
- Reference specific details (domains, wording, phone numbers, instructions, claims) rather than generic advice.
- Write the customer-facing fields ("headline", "explanation", "actions") in warm, plain English a nervous non-technical person can follow. No jargon, no blame — people who get scammed aren't silly, they're unfamiliar.
- Keep actions short, direct and specific (max 5). E.g. "Do not click the link", "Block the number", "If you shared bank details, call your bank now on the number on the back of your card", "Report it to Action Fraud on 0300 123 2040".
- If there genuinely isn't enough information, use verdict "insufficient_info" and say what extra detail would help.
- Respond with valid JSON only, matching the schema.`;

    const context = {
      category: sub.category,
      structured_answers: sub.details && Object.keys(sub.details).length ? sub.details : null,
      customer_description: sub.description,
      pasted_message: sub.pasted_text || null,
      text_extracted_from_screenshots: ocrText || null,
    };

    const triageRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyse this scam-check request and respond as JSON.\n\n${JSON.stringify(context, null, 2)}\n\nJSON fields required:
- "verdict": "likely_scam" | "suspicious" | "likely_safe" | "insufficient_info"
- "risk_level": "low" | "medium" | "high" | "critical"
- "headline": one warm plain-English sentence giving the verdict (customer-facing)
- "explanation": 3-6 sentences explaining WHY, referencing the specific details found (customer-facing)
- "indicators": 2-5 short factual warning signs (or reassuring signs) found in the material
- "actions": 3-5 short, specific next steps for the customer
- "extracted_phones": array of phone numbers found in the material (or [])
- "extracted_links": array of URLs/domains found in the material (or [])
- "extracted_emails": array of email addresses found (or [])
- "likely_pattern": short name of the scam pattern if any, e.g. "Courier fee phishing text", else "N/A"
- "confidence": 0.0-1.0, honest`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!triageRes.ok) {
      const t = await triageRes.text();
      console.error("[analyze] Triage failed:", triageRes.status, t);
      return res.status(500).json({ ok: false, error: "AI analysis failed" });
    }
    const triageData = await triageRes.json();
    let report;
    try {
      report = JSON.parse(triageData.choices?.[0]?.message?.content || "{}");
    } catch {
      return res.status(500).json({ ok: false, error: "AI returned invalid JSON" });
    }

    /* ── 3. Gemini web-research corroboration ─────────────────────── */
    let corroboration = { status: "not_performed", summary: null, sources: [], search_performed: false };
    const marker =
      (report.extracted_phones || [])[0] ||
      (report.extracted_emails || [])[0] ||
      (report.extracted_links || [])[0] ||
      null;

    if (GEMINI_KEY && marker) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Search for public scam reports, fraud warnings, complaints or lookups for this marker: ${marker}

Classify your findings:
- "direct_match": pages reference THIS EXACT marker with scam/fraud/complaint context
- "related_match": reports about the same number range or domain, but not this exact marker
- "generic_only": only generic advice pages
- "no_evidence": nothing relevant

Respond in this exact format:
CLASSIFICATION: [direct_match|related_match|generic_only|no_evidence]
SUMMARY: [2-3 sentences summarising findings with specific sources]
SOURCES: [comma-separated URLs, or "none"]`,
                    },
                  ],
                },
              ],
              tools: [{ google_search: {} }],
            }),
          }
        );
        if (geminiRes.ok) {
          const g = await geminiRes.json();
          const text = g.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const chunks = g.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          const urls = [...new Set(chunks.map((c) => c.web?.uri).filter(Boolean))];
          const cls = (text.match(/CLASSIFICATION:\s*(direct_match|related_match|generic_only|no_evidence)/i)?.[1] || "no_evidence").toLowerCase();
          const summary = text.match(/SUMMARY:\s*(.+?)(?=\nSOURCES:|$)/is)?.[1]?.trim() || null;
          corroboration = {
            status: cls === "direct_match" ? "corroboration_found" : cls === "related_match" ? "related_evidence" : "no_corroboration",
            classification: cls,
            summary,
            sources: urls.slice(0, 5),
            search_performed: true,
            marker,
          };
          if (cls === "direct_match" && report.verdict !== "likely_scam") {
            report.verdict = "likely_scam";
            report.risk_level = report.risk_level === "low" ? "medium" : report.risk_level;
            report.explanation += " Public scam reports were also found referencing the exact contact details in this message.";
          }
        }
      } catch (e) {
        console.error("[analyze] Gemini error (non-blocking):", e.message || e);
        corroboration = { status: "unavailable", summary: null, sources: [], search_performed: false };
      }
    }

    /* ── 4. Store report, set awaiting_review, ping Kieran ────────── */
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/ai_reports`, {
      method: "POST",
      headers: { ...sb, Prefer: "return=representation" },
      body: JSON.stringify({
        submission_id: sub.id,
        verdict: report.verdict || "insufficient_info",
        risk_level: report.risk_level || "medium",
        headline: report.headline || "We've taken a look at what you sent.",
        explanation: report.explanation || "",
        indicators: report.indicators || [],
        actions: report.actions || [],
        extracted_links: report.extracted_links || [],
        extracted_phones: report.extracted_phones || [],
        corroboration,
        ocr_text: ocrText || null,
        confidence: typeof report.confidence === "number" ? report.confidence : null,
        model: "gpt-4o-mini + gemini-2.5-flash",
        raw: report,
      }),
    });
    if (!insRes.ok) {
      const t = await insRes.text();
      console.error("[analyze] Report insert failed:", insRes.status, t);
      return res.status(500).json({ ok: false, error: "Could not store report" });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${sub.id}`, {
      method: "PATCH",
      headers: sb,
      body: JSON.stringify({ status: "awaiting_review" }),
    });

    const verdictEmoji =
      report.verdict === "likely_scam" ? "🚨" : report.verdict === "suspicious" ? "⚠️" : report.verdict === "likely_safe" ? "✅" : "❓";
    const caseUrl = `https://second-look-protect.vercel.app/admin?case=${sub.id}`;
    await notifyKieran({
      subject: `${verdictEmoji} AI report ready: ${report.verdict} — ${sub.name}`,
      html:
        `<h2>AI report ready for your review</h2>` +
        `<p><strong>${sub.name}</strong> · ${sub.email} · ${sub.member_status}</p>` +
        `<p>Verdict: <strong>${report.verdict}</strong> · Risk: ${report.risk_level} · Confidence: ${report.confidence}</p>` +
        `<p>${report.headline || ""}</p>` +
        `<p><a href="${caseUrl}">Review &amp; approve this case</a></p>`,
      whatsappText: `${verdictEmoji} AI report ready for ${sub.name}: ${report.verdict} (${report.risk_level}). Review & approve: ${caseUrl}`,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[analyze] Error:", e.message || e);
    return res.status(500).json({ ok: false, error: "Unexpected error" });
  }
}
