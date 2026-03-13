// /api/ai-triage.js â€” Automatic AI triage generation after case creation
export default async function handler(req, res) {
  console.log('[ai-triage] â–¶ Request received:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  console.log('[ai-triage] Env check â€” SUPABASE_URL present:', !!SUPABASE_URL);
  console.log('[ai-triage] Env check â€” SUPABASE_SERVICE_ROLE_KEY present:', !!SERVICE_KEY);
  console.log('[ai-triage] Env check â€” OPENAI_API_KEY present:', !!OPENAI_KEY);

  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!OPENAI_KEY) missing.push('OPENAI_API_KEY');
  if (missing.length > 0) {
    console.error('[ai-triage] âœ– Missing env vars:', missing.join(', '));
    return res.status(500).json({ ok: false, error: `Missing env vars: ${missing.join(', ')}` });
  }

  try {
    const { case_id, organisation_id } = req.body || {};
    console.log('[ai-triage] Body parsed â€” case_id:', case_id, '| organisation_id:', organisation_id);

    if (!case_id || !organisation_id) {
      console.error('[ai-triage] âœ– Missing required fields in body');
      return res.status(400).json({ ok: false, error: 'case_id and organisation_id are required' });
    }

    /* 1. Check if AI triage already exists for this case */
    console.log('[ai-triage] Step 1: Checking for existing triage result...');
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_triage_results?case_id=eq.${encodeURIComponent(case_id)}&limit=1`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      },
    );
    console.log('[ai-triage] Duplicate check response status:', existingRes.status);
    if (existingRes.ok) {
      const existing = await existingRes.json();
      console.log('[ai-triage] Existing triage rows found:', existing.length);
      if (existing.length > 0) {
        console.log('[ai-triage] â­ Skipping â€” triage already exists for case_id:', case_id);
        return res.status(200).json({ ok: true, skipped: true, reason: 'AI triage already exists' });
      }
    } else {
      const dupErrText = await existingRes.text();
      console.error('[ai-triage] âš  Duplicate check failed:', existingRes.status, dupErrText);
    }

    /* 2. Fetch the case record */
    console.log('[ai-triage] Step 2: Fetching case record...');
    const caseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cases?id=eq.${encodeURIComponent(case_id)}&organisation_id=eq.${encodeURIComponent(organisation_id)}&limit=1`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Accept: 'application/vnd.pgrst.object+json',
        },
      },
    );
    console.log('[ai-triage] Case fetch response status:', caseRes.status);
    if (!caseRes.ok) {
      const text = await caseRes.text();
      console.error('[ai-triage] âœ– Failed to fetch case:', caseRes.status, text);
      return res.status(500).json({ ok: false, error: `Failed to fetch case: ${text}`, step: 'case_fetch', status: caseRes.status });
    }
    const caseRow = await caseRes.json();
    console.log('[ai-triage] Case fetched â€” id:', caseRow.id, '| organisation_id:', caseRow.organisation_id, '| submission_type:', caseRow.submission_type, '| status:', caseRow.status);

    // Defensive check: organisation_id must be present on the case record
    if (!caseRow.organisation_id) {
      console.error('[ai-triage] âœ– Case record has no organisation_id â€” cannot insert triage result');
      return res.status(500).json({ ok: false, error: 'Case record missing organisation_id', step: 'org_check' });
    }

    /* 3. Build the prompt */
    const caseContext = {
      id: caseRow.id,
      organisation_id: caseRow.organisation_id,
      submitted_by: caseRow.submitted_by,
      title: caseRow.title || null,
      description: caseRow.description || null,
      channel: caseRow.channel || null,
      risk_level: caseRow.risk_level || null,
      status: caseRow.status || null,
      resident_ref: caseRow.resident_ref || null,
      category: caseRow.category || null,
      loss_amount: caseRow.loss_amount || null,
      submission_type: caseRow.submission_type || null,
      evidence_count: caseRow.evidence_count ?? 0,
      needs_review: caseRow.needs_review ?? null,
      meta: caseRow.meta || null,
      assigned_to: caseRow.assigned_to || null,
    };

    /* 3a. Pre-processing: Screenshot OCR for image-bearing case types */
    let ocrText = null;
    let extractedEntities = null;
    const IMAGE_TRIAGE_TYPES = ['suspicious_email', 'suspicious_letter'];
    const hasImageEvidence = IMAGE_TRIAGE_TYPES.includes(caseRow.submission_type) && caseRow.meta?.evidence?.length > 0;

    console.log(`[ai-triage] [screenshot-pipeline] ═══ SCREENSHOT TRIAGE PIPELINE START ═══`);
    console.log(`[ai-triage] [screenshot-pipeline] case_id: ${case_id}`);
    console.log(`[ai-triage] [screenshot-pipeline] submission_type: ${caseRow.submission_type}`);
    console.log(`[ai-triage] [screenshot-pipeline] image_attached: ${hasImageEvidence}`);
    console.log(`[ai-triage] [screenshot-pipeline] evidence_entries: ${caseRow.meta?.evidence?.length ?? 0}`);

    if (hasImageEvidence) {
      // Find the first image attachment — check both url and path fields
      const imageAttachment = caseRow.meta.evidence.find(ev => {
        const checkUrl = (ev.url || '').toLowerCase();
        const checkPath = (ev.path || '').toLowerCase();
        const isImage = (s) => s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.webp');
        return (ev.url && isImage(checkUrl)) || (ev.path && isImage(checkPath));
      });

      if (imageAttachment) {
        console.log(`[ai-triage] [screenshot-pipeline] Image found — url: ${imageAttachment.url?.slice(0, 100)} | path: ${imageAttachment.path || 'none'}`);

        /* ── Resolve accessible image URL ────────────────────────────── */
        let accessibleUrl = null;
        try {
          // Strategy 1: If evidence has a storage path, generate a signed URL (works for private buckets)
          if (imageAttachment.path) {
            console.log(`[ai-triage] [screenshot-pipeline] Generating signed URL from storage path: ${imageAttachment.path}`);
            const signedRes = await fetch(
              `${SUPABASE_URL}/storage/v1/object/sign/evidence/${imageAttachment.path.split('/').map(s => encodeURIComponent(s)).join('/')}`,
              {
                method: 'POST',
                headers: {
                  apikey: SERVICE_KEY,
                  Authorization: `Bearer ${SERVICE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ expiresIn: 300 }), // 5-minute signed URL
              }
            );
            if (signedRes.ok) {
              const signedData = await signedRes.json();
              if (signedData.signedURL) {
                accessibleUrl = `${SUPABASE_URL}/storage/v1${signedData.signedURL}`;
                console.log(`[ai-triage] [screenshot-pipeline] ✔ Signed URL generated (${accessibleUrl.length} chars)`);
              }
            } else {
              const signedErr = await signedRes.text();
              console.warn(`[ai-triage] [screenshot-pipeline] Signed URL failed (${signedRes.status}): ${signedErr}`);
            }
          }

          // Strategy 2: Fall back to the stored public URL
          if (!accessibleUrl && imageAttachment.url) {
            accessibleUrl = imageAttachment.url;
            console.log(`[ai-triage] [screenshot-pipeline] Using stored public URL: ${accessibleUrl.slice(0, 100)}`);

            // Quick check: if the URL is a Supabase storage URL, verify it's accessible
            if (accessibleUrl.includes('/storage/v1/object/public/')) {
              try {
                const headRes = await fetch(accessibleUrl, { method: 'HEAD' });
                if (!headRes.ok) {
                  console.warn(`[ai-triage] [screenshot-pipeline] ⚠ Public URL returned ${headRes.status} — image may not be accessible`);
                  // Try signed URL as fallback if we have a path
                  if (imageAttachment.path && !accessibleUrl.includes('token=')) {
                    console.log(`[ai-triage] [screenshot-pipeline] Attempting signed URL fallback...`);
                    const signedRes2 = await fetch(
                      `${SUPABASE_URL}/storage/v1/object/sign/evidence/${imageAttachment.path.split('/').map(s => encodeURIComponent(s)).join('/')}`,
                      {
                        method: 'POST',
                        headers: {
                          apikey: SERVICE_KEY,
                          Authorization: `Bearer ${SERVICE_KEY}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ expiresIn: 300 }),
                      }
                    );
                    if (signedRes2.ok) {
                      const signedData2 = await signedRes2.json();
                      if (signedData2.signedURL) {
                        accessibleUrl = `${SUPABASE_URL}/storage/v1${signedData2.signedURL}`;
                        console.log(`[ai-triage] [screenshot-pipeline] ✔ Signed URL fallback succeeded`);
                      }
                    }
                  }
                } else {
                  console.log(`[ai-triage] [screenshot-pipeline] ✔ Public URL verified accessible (HEAD ${headRes.status})`);
                }
              } catch (headErr) {
                console.warn(`[ai-triage] [screenshot-pipeline] HEAD check error: ${headErr.message}`);
              }
            }
          }
        } catch (urlErr) {
          console.error(`[ai-triage] [screenshot-pipeline] ✖ URL resolution error: ${urlErr.message}`);
          accessibleUrl = imageAttachment.url; // last resort fallback
        }

        if (!accessibleUrl) {
          console.error(`[ai-triage] [screenshot-pipeline] ✖ No accessible image URL could be resolved — skipping OCR`);
          console.log(`[ai-triage] [screenshot-pipeline] OCR attempted: false (no accessible URL)`);
        } else {
          console.log(`[ai-triage] [screenshot-pipeline] OCR attempted: true`);
          console.log(`[ai-triage] [screenshot-pipeline] Accessible URL (truncated): ${accessibleUrl.slice(0, 120)}...`);

          try {
            const ocrStart = Date.now();
            const OCR_TIMEOUT_MS = 25000;
            const ocrController = new AbortController();
            const ocrTimer = setTimeout(() => ocrController.abort(), OCR_TIMEOUT_MS);

            const ocrRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_KEY}`,
              },
              signal: ocrController.signal,
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: caseRow.submission_type === 'suspicious_letter'
                          ? 'Extract all readable text from this photograph or scan of a physical letter/document exactly as written. Include all visible text: headers, body text, signatures, URLs, QR code labels, return addresses, reference numbers, and any fine print. Return only the extracted text, no commentary.'
                          : 'Extract all readable text from this screenshot exactly as written. Return only the extracted text, no commentary.'
                      },
                      { type: 'image_url', image_url: { url: accessibleUrl } }
                    ]
                  }
                ],
                max_tokens: 2000
              })
            });

            clearTimeout(ocrTimer);
            const ocrElapsed = Date.now() - ocrStart;

            if (ocrRes.ok) {
              const ocrData = await ocrRes.json();
              ocrText = ocrData.choices?.[0]?.message?.content?.trim();
              if (ocrText) {
                console.log(`[ai-triage] [screenshot-pipeline] ✔ OCR SUCCESS — extracted_text_length: ${ocrText.length} | elapsed: ${ocrElapsed}ms`);
                console.log(`[ai-triage] [screenshot-pipeline] OCR text preview (first 300 chars): ${ocrText.slice(0, 300)}`);

                // Inject extracted text into case context
                if (!caseContext.meta) caseContext.meta = {};
                if (!caseContext.meta.details) caseContext.meta.details = {};
                caseContext.meta.details.extracted_text_from_screenshot = ocrText;

                // ── Entity extraction from OCR text ──────────────────────────
                extractedEntities = extractEntitiesFromText(ocrText);
                if (extractedEntities) {
                  caseContext.meta.details.extracted_entities = extractedEntities;
                  console.log(`[ai-triage] [screenshot-pipeline] Extracted entities: ${JSON.stringify(extractedEntities)}`);
                }
                console.log(`[ai-triage] [screenshot-pipeline] Evidence text passed to provider: true`);
              } else {
                console.log(`[ai-triage] [screenshot-pipeline] OCR completed but returned no text | elapsed: ${ocrElapsed}ms`);
                console.log(`[ai-triage] [screenshot-pipeline] OCR success: false (empty result)`);
              }
            } else {
              const ocrErrText = await ocrRes.text();
              console.warn(`[ai-triage] [screenshot-pipeline] ✖ OCR FAILED — status: ${ocrRes.status} | elapsed: ${ocrElapsed}ms | body: ${ocrErrText.slice(0, 500)}`);
              console.log(`[ai-triage] [screenshot-pipeline] OCR success: false (API error ${ocrRes.status})`);
            }
          } catch (ocrErr) {
            const isTimeout = ocrErr.name === 'AbortError';
            console.error(`[ai-triage] [screenshot-pipeline] ✖ OCR error: ${isTimeout ? 'TIMEOUT (25s)' : ocrErr.message}`);
            console.log(`[ai-triage] [screenshot-pipeline] OCR success: false (${isTimeout ? 'timeout' : 'exception'})`);
            // Fail gracefully, don't block the main triage flow
          }
        }
      } else {
        const evidenceUrls = (caseRow.meta.evidence || []).map(e => e.url || e.path || 'no-url').join(', ');
        console.log(`[ai-triage] [screenshot-pipeline] No image attachments found among evidence entries`);
        console.log(`[ai-triage] [screenshot-pipeline] Evidence URLs/paths present: ${evidenceUrls}`);
        console.log(`[ai-triage] [screenshot-pipeline] OCR attempted: false (no image files matching png/jpg/jpeg/webp)`);
      }
    } else {
      console.log(`[ai-triage] [screenshot-pipeline] Skipping OCR — not an image-bearing type or no evidence`);
    }
    console.log(`[ai-triage] [screenshot-pipeline] ═══ OCR PHASE COMPLETE | ocrText: ${ocrText ? ocrText.length + ' chars' : 'null'} ═══`);

    /* ── Build evidence-aware prompt additions for letter/image cases ──── */
    let evidencePromptAddition = '';
    if (ocrText && (caseRow.submission_type === 'suspicious_letter' || caseRow.submission_type === 'suspicious_email')) {
      const isLetter = caseRow.submission_type === 'suspicious_letter';
      console.log(`[ai-triage] [screenshot-pipeline] Building evidence-aware prompt addition for ${caseRow.submission_type}`);
      evidencePromptAddition = `\n\nIMPORTANT — EXTRACTED EVIDENCE FROM UPLOADED SCREENSHOT:\nThe user uploaded ${isLetter ? 'a photograph/scan of a physical letter' : 'a screenshot of a suspicious email'}. The following text was extracted from the image via OCR. Base your analysis primarily on this extracted content:\n\n--- START EXTRACTED TEXT ---\n${ocrText}\n--- END EXTRACTED TEXT ---\n`;

      if (extractedEntities) {
        const eParts = [];
        if (extractedEntities.domains?.length) eParts.push(`Domains/URLs found: ${extractedEntities.domains.join(', ')}`);
        if (extractedEntities.brandNames?.length) eParts.push(`Brand/service names referenced: ${extractedEntities.brandNames.join(', ')}`);
        if (extractedEntities.walletSecurityLanguage?.length) eParts.push(`Wallet/security/payment language: ${extractedEntities.walletSecurityLanguage.join(', ')}`);
        if (extractedEntities.qrReferences?.length) eParts.push(`QR code references: ${extractedEntities.qrReferences.join(', ')}`);
        if (extractedEntities.urgencyLanguage?.length) eParts.push(`Urgency/pressure language: ${extractedEntities.urgencyLanguage.join(', ')}`);
        if (extractedEntities.impersonationCues?.length) eParts.push(`Impersonation indicators: ${extractedEntities.impersonationCues.join(', ')}`);
        if (extractedEntities.contactInfo?.length) eParts.push(`Contact info/references: ${extractedEntities.contactInfo.join(', ')}`);
        if (eParts.length > 0) {
          evidencePromptAddition += `\nExtracted suspicious indicators:\n${eParts.map(p => '• ' + p).join('\n')}\n`;
        }
      }

      evidencePromptAddition += `\nYour report MUST specifically reference the details found in this extracted text. Do NOT produce a generic summary. Identify the specific scam pattern, suspicious domains, impersonation tactics, pressure language, and any instructions (like QR codes or wallet validation) found in the ${isLetter ? 'letter' : 'email'}.`;
      console.log(`[ai-triage] [screenshot-pipeline] Evidence prompt addition length: ${evidencePromptAddition.length} chars | entities present: ${!!extractedEntities} | report will use evidence-derived details: true`);
    } else if (IMAGE_TRIAGE_TYPES.includes(caseRow.submission_type) && !ocrText) {
      console.log(`[ai-triage] [screenshot-pipeline] No OCR text available for ${caseRow.submission_type} — fallback generic summary logic will be used: true`);
    }

    const systemPrompt = `You are a safeguarding triage assistant for UK care homes. You help staff prioritise and categorise safeguarding cases involving vulnerable adults. You produce concise, direct, operational assessments.

Rules:
- You are advisory only â€” never a final decision-maker.
- Be specific to the submitted case details. Do not invent facts.
- Do not imply external research, phone number lookups, or web checks were performed. Your analysis is based solely on the submitted case details.
- Do not identify a specific offender by name.
- Suggest the likely scam pattern only â€” do not overclaim.
- Always set human_review_required to true.
- Use direct UK safeguarding-style operational wording.
- Avoid vague management-speak like "assess the intent", "protect from exploitation", or "monitor generally".
- Keep recommended actions direct, short, and specific to the case (max 5 items).
- Keep indicators concise and factual (max 5 items).
- If extracted text from a screenshot/document is provided, your analysis MUST be grounded in that evidence. Reference specific details from the text (domains, wording, instructions, claims) rather than giving a generic summary.
- Respond with valid JSON only matching the required schema.`;

    const userPrompt = `Triage the following safeguarding case. Base your analysis strictly on the submitted case details below.

Case data:
${JSON.stringify(caseContext, null, 2)}${evidencePromptAddition}

Produce your response as JSON with these fields:

- "summary": Write 1â€“3 concise sentences covering: (A) What happened â€” the actual reported incident, (B) What is known from the case details, (C) What is NOT confirmed (e.g. no payment confirmed, no bank details confirmed shared, caller identity not verified). Be factual and specific.

- "risk_level": "low" | "medium" | "high" | "critical" â€” based on submitted details only.

- "suggested_category": One of: financial, romance, phishing, impersonation, doorstep, welfare, or other.

- "suggested_urgency": "routine" | "24_hours" | "same_day" | "immediate".

- "likely_scam_pattern": A short practical description of the likely pattern (e.g. "Impersonation of utility company via phone call requesting payment by gift card"). Write "N/A" if no pattern detected. Do not overclaim.

- "actions": 3â€“5 direct, short, practical safeguarding next steps specific to this case. Good: "Record the phone number in case notes", "Check whether any money was sent", "Advise the resident not to engage further", "Notify the safeguarding lead today", "Block the number where possible". Avoid vague actions.

- "indicators": 2â€“5 short factual risk indicators drawn from the case details only.

- "confidence": A number between 0.0 and 1.0 representing confidence in this triage. Be honest â€” if there is limited information, give a lower score.

- "repeat_targeting_suspected": true or false â€” whether this looks like the resident may have been targeted before.

- "financial_harm_indicator": true or false â€” whether financial loss or risk of financial loss is indicated.

- "human_review_required": Always true.

- "extracted_phone_numbers": An array of phone numbers found in the case details (e.g. sender number, numbers in the message/email body). Return an empty array if none found.

- "extracted_links": An array of URLs or domains found in the case details (e.g. links in the message/email). Return an empty array if none found.`;



    /* 4. Call OpenAI Responses API */
    const MODEL = 'gpt-4o-mini';
    console.log('[ai-triage] OpenAI triage request starting â€” model:', MODEL, '| OPENAI_API_KEY present:', !!OPENAI_KEY);
    const triageOpenaiStart = Date.now();
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_triage_result',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                suggested_category: { type: 'string' },
                suggested_urgency: { type: 'string', enum: ['routine', '24_hours', 'same_day', 'immediate'] },
                likely_scam_pattern: { type: 'string' },
                actions: { type: 'array', items: { type: 'string' } },
                indicators: { type: 'array', items: { type: 'string' } },
                confidence: { type: 'number' },
                repeat_targeting_suspected: { type: 'boolean' },
                financial_harm_indicator: { type: 'boolean' },
                human_review_required: { type: 'boolean' },
                extracted_phone_numbers: { type: 'array', items: { type: 'string' } },
                extracted_links: { type: 'array', items: { type: 'string' } },
              },
              required: [
                'summary', 'risk_level', 'suggested_category', 'suggested_urgency',
                'likely_scam_pattern', 'actions', 'indicators', 'confidence',
                'repeat_targeting_suspected', 'financial_harm_indicator', 'human_review_required',
                'extracted_phone_numbers', 'extracted_links',
              ],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    const triageOpenaiElapsed = Date.now() - triageOpenaiStart;
    console.log('[ai-triage] OpenAI triage request completed â€” status:', openaiRes.status, '| elapsed:', triageOpenaiElapsed + 'ms', '| model:', MODEL);

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('[ai-triage] âœ– OpenAI triage FAILED â€” status:', openaiRes.status, '| elapsed:', triageOpenaiElapsed + 'ms', '| body:', errText);
      return res.status(500).json({ ok: false, error: `OpenAI API error: ${openaiRes.status}`, step: 'openai', details: errText });
    }

    const openaiData = await openaiRes.json();
    console.log('[ai-triage] OpenAI triage SUCCESS â€” output items:', openaiData.output?.length ?? 0, '| elapsed:', triageOpenaiElapsed + 'ms');

    // Extract the text content from the Responses API format
    let aiOutput;
    try {
      const textContent = openaiData.output
        ?.find((item) => item.type === 'message')
        ?.content?.find((c) => c.type === 'output_text');
      console.log('[ai-triage] OpenAI triage structured output â€” text present:', !!textContent?.text);
      aiOutput = JSON.parse(textContent?.text || '{}');
      console.log('[ai-triage] OpenAI triage parsed successfully â€” keys:', Object.keys(aiOutput).join(', '));
    } catch (parseErr) {
      console.error('[ai-triage] âœ– OpenAI triage parse FAILED:', parseErr.message);
      console.error('[ai-triage] Raw openaiData.output:', JSON.stringify(openaiData.output, null, 2));
      return res.status(500).json({ ok: false, error: 'Failed to parse AI response', step: 'parse', details: parseErr.message });
    }

    /* 5. Insert into ai_triage_results */
    const triageRow = {
      case_id: caseRow.id,
      organisation_id: caseRow.organisation_id,
      model: MODEL,
      risk_level: aiOutput.risk_level || null,
      summary: aiOutput.summary || null,
      actions: aiOutput.actions || [],
      indicators: aiOutput.indicators || [],
      confidence: typeof aiOutput.confidence === 'number' ? aiOutput.confidence : null,
      suggested_category: aiOutput.suggested_category || null,
      suggested_urgency: aiOutput.suggested_urgency || null,
      likely_scam_pattern: aiOutput.likely_scam_pattern || null,
      repeat_targeting_suspected: aiOutput.repeat_targeting_suspected ?? null,
      financial_harm_indicator: aiOutput.financial_harm_indicator ?? null,
      human_review_required: aiOutput.human_review_required ?? true,
      raw_response: openaiData,
    };

    /* Determine phone number from explicit extraction or fallback to case meta */
    let phoneNumber = caseRow.meta?.details?.phone_number || caseRow.meta?.details?.sender || null;
    if (aiOutput.extracted_phone_numbers && aiOutput.extracted_phone_numbers.length > 0) {
      phoneNumber = aiOutput.extracted_phone_numbers[0]; // Take the first extracted number
    }

    /* Determine email address for intelligence */
    const senderEmail = caseRow.meta?.details?.sender_email || null;

    /* Determine URL for intelligence */
    const urlObj = caseRow.meta?.details?.url || null;

    /* Flag intelligence as pending if we have an actionable observable (cleared by PATCH after pipeline completes) */
    if (phoneNumber || senderEmail || urlObj) {
      triageRow.raw_response = { ...openaiData, number_intel_pending: true };
    }

    console.log('[ai-triage] Step 4: Inserting into ai_triage_results â€” case_id:', case_id, '| risk_level:', triageRow.risk_level, '| category:', triageRow.suggested_category);
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/ai_triage_results`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(triageRow),
    });

    console.log('[ai-triage] Supabase insert response status:', insertRes.status);

    if (!insertRes.ok) {
      const text = await insertRes.text();
      console.error('[ai-triage] âœ– Supabase insert error â€” status:', insertRes.status, '| body:', text);
      return res.status(500).json({ ok: false, error: `Failed to save triage result: ${insertRes.status}`, step: 'insert', details: text });
    }

    /* 6. Extract inserted row ID for number intelligence */
    let triageId = null;
    try {
      const inserted = await insertRes.json();
      triageId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
    } catch { /* proceed without ID */ }

    console.log('[ai-triage] âœ” AI triage generated and saved successfully for case_id:', case_id, '| triage_id:', triageId);

    /* 7. Automatically run source-backed intelligence if phone number, email, URL, or OCR text exists */
    let isOcrEmail = false;
    let extractedEntities = null;

    if (caseRow.submission_type === 'suspicious_email' && (ocrText || caseRow.meta?.details?.extracted_text_from_screenshot)) {
      isOcrEmail = true;
      ocrText = ocrText || caseRow.meta?.details?.extracted_text_from_screenshot;
      console.log(`[ocr-intel-report] Image attached: yes, OCR text length: ${ocrText?.length || 0}`);
    }

    if ((phoneNumber || senderEmail || urlObj || isOcrEmail) && triageId) {
      console.log('[ai-triage] Step 5: Observable/OCR found, running source-backed intelligence. Phone:', phoneNumber, '| Email:', senderEmail, '| URL:', urlObj, '| isOcrEmail:', isOcrEmail);

      try {
        /* 7-pre. If OCR Email, extract entities first to drive targeted research */
        if (isOcrEmail && ocrText) {
          console.log('[ocr-intel-report] Starting entity extraction from OCR text...');
          const extractStart = Date.now();
          const extractRes = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_KEY}`,
            },
            body: JSON.stringify({
              model: MODEL,
              input: [
                { role: 'system', content: 'You are a safeguarding data extraction assistant. Extract key entities and suspicious claims from the provided email OCR text to help drive targeted scam research.' },
                { role: 'user', content: `Extract entities from this OCR text:\n\n${ocrText}` }
              ],
              text: {
                format: {
                  type: 'json_schema',
                  name: 'ocr_entities',
                  strict: true,
                  schema: {
                    type: 'object',
                    properties: {
                      brands: { type: 'array', items: { type: 'string' }, description: 'Companies or brands mentioned (e.g. PayPal, Netflix, HMRC)' },
                      claims: { type: 'array', items: { type: 'string' }, description: 'Suspicious claims made (e.g. Account suspended, Invoice due, Unusual login)' },
                      urgency_cues: { type: 'array', items: { type: 'string' }, description: 'Phrases creating urgency (e.g. Act immediately, Within 24 hours)' }
                    },
                    required: ['brands', 'claims', 'urgency_cues'],
                    additionalProperties: false
                  }
                }
              }
            })
          });

          if (extractRes.ok) {
            const extractData = await extractRes.json();
            try {
              const tc = extractData.output?.find((i) => i.type === 'message')?.content?.find((c) => c.type === 'output_text');
              extractedEntities = JSON.parse(tc?.text || '{}');
              console.log('[ocr-intel-report] Extracted entities/claims:', JSON.stringify(extractedEntities));
            } catch (err) {
              console.error('[ocr-intel-report] Failed to parse extracted entities:', err.message);
            }
          } else {
            console.warn('[ocr-intel-report] Entity extraction API failed:', extractRes.status);
          }
        }

        const IPQS_KEY = process.env.IPQS_API_KEY;
        let externalLookup = null;
        let externalEmailLookup = null;
        let externalUrlLookup = null;
        let lookupStatus = 'unavailable';
        let sourcesChecked = [];

        /* 7a. External phone and email reputation lookups via IPQualityScore */
        if (IPQS_KEY) {
          if (phoneNumber) {
            try {
              const cleanNumber = phoneNumber.replace(/[\s\-()]/g, '');
              const ipqsUrl = `https://ipqualityscore.com/api/json/phone/${encodeURIComponent(IPQS_KEY)}/${encodeURIComponent(cleanNumber)}?country[]=GB&country[]=US`;
              console.log('[ai-triage] Calling IPQualityScore for phone:', cleanNumber);
              const ipqsRes = await fetch(ipqsUrl, { method: 'GET' });
              if (ipqsRes.ok) {
                const ipqsData = await ipqsRes.json();
                if (ipqsData.success) {
                  externalLookup = {
                    fraud_score: ipqsData.fraud_score ?? null,
                    recent_abuse: ipqsData.recent_abuse ?? null,
                    voip: ipqsData.VOIP ?? null,
                    prepaid: ipqsData.prepaid ?? null,
                    active: ipqsData.active ?? null,
                    carrier: ipqsData.carrier || null,
                    line_type: ipqsData.line_type || null,
                    country: ipqsData.country || null,
                    city: ipqsData.city || null,
                    risky: ipqsData.risky ?? null,
                    valid: ipqsData.valid ?? null,
                    name: ipqsData.name || null,
                    spammer: ipqsData.spammer ?? null,
                    do_not_call: ipqsData.do_not_call ?? null,
                  };
                  sourcesChecked.push('IPQualityScore phone reputation database');
                  // Determine match status
                  if (ipqsData.fraud_score >= 75 || ipqsData.recent_abuse === true || ipqsData.risky === true || ipqsData.spammer === true) {
                    lookupStatus = 'match_found';
                  } else if (ipqsData.fraud_score != null) {
                    lookupStatus = 'no_match';
                  }
                  console.log('[ai-triage] IPQS Phone result â€” fraud_score:', ipqsData.fraud_score, '| recent_abuse:', ipqsData.recent_abuse, '| risky:', ipqsData.risky);
                } else {
                  console.error('[ai-triage] IPQS Phone returned success=false:', ipqsData.message || 'unknown');
                }
              } else {
                console.error('[ai-triage] IPQS Phone HTTP error:', ipqsRes.status);
              }
            } catch (ipqsErr) {
              console.error('[ai-triage] IPQS Phone lookup error (non-blocking):', ipqsErr.message || ipqsErr);
            }
          }

          if (senderEmail) {
            try {
              const ipqsEmailUrl = `https://ipqualityscore.com/api/json/email/${encodeURIComponent(IPQS_KEY)}/${encodeURIComponent(senderEmail)}`;
              console.log('[ai-triage] Calling IPQualityScore for email:', senderEmail);
              const ipqsEmailRes = await fetch(ipqsEmailUrl, { method: 'GET' });
              if (ipqsEmailRes.ok) {
                const ipqsData = await ipqsEmailRes.json();
                if (ipqsData.success) {
                  externalEmailLookup = {
                    fraud_score: ipqsData.fraud_score ?? null,
                    recent_abuse: ipqsData.recent_abuse ?? null,
                    disposable: ipqsData.disposable ?? null,
                    deliverable: ipqsData.deliverable ?? null,
                    suspect: ipqsData.suspect ?? null,
                    domain_age: ipqsData.domain_age ?? null,
                    first_seen: ipqsData.first_seen ?? null,
                    honeypot: ipqsData.honeypot ?? null,
                    leaked: ipqsData.leaked ?? null,
                    sanitized_email: ipqsData.sanitized_email ?? null,
                  };
                  sourcesChecked.push('IPQualityScore email reputation database');
                  // Determine match status
                  if (ipqsData.fraud_score >= 75 || ipqsData.recent_abuse === true || ipqsData.suspect === true) {
                    lookupStatus = 'match_found';
                  } else if (ipqsData.fraud_score != null && lookupStatus === 'unavailable') {
                    lookupStatus = 'no_match';
                  }
                  console.log('[ai-triage] IPQS Email result â€” fraud_score:', ipqsData.fraud_score, '| recent_abuse:', ipqsData.recent_abuse, '| suspect:', ipqsData.suspect);
                } else {
                  console.error('[ai-triage] IPQS Email returned success=false:', ipqsData.message || 'unknown');
                }
              } else {
                console.error('[ai-triage] IPQS Email HTTP error:', ipqsEmailRes.status);
              }
            } catch (ipqsErr) {
              console.error('[ai-triage] IPQS Email lookup error (non-blocking):', ipqsErr.message || ipqsErr);
            }
          }

          if (urlObj) {
            try {
              const encUrl = encodeURIComponent(urlObj);
              const ipqsUrlApi = `https://ipqualityscore.com/api/json/url/${encodeURIComponent(IPQS_KEY)}/${encUrl}`;
              console.log('[ai-triage] Calling IPQualityScore for URL:', urlObj);
              const ipqsUrlRes = await fetch(ipqsUrlApi, { method: 'GET' });
              if (ipqsUrlRes.ok) {
                const ipqsData = await ipqsUrlRes.json();
                if (ipqsData.success) {
                  externalUrlLookup = {
                    risk_score: ipqsData.risk_score ?? null,
                    malware: ipqsData.malware ?? null,
                    phishing: ipqsData.phishing ?? null,
                    spamming: ipqsData.spamming ?? null,
                    suspicious: ipqsData.suspicious ?? null,
                    adult: ipqsData.adult ?? null,
                    category: ipqsData.category ?? null,
                    domain_age: ipqsData.domain_age?.human ?? null,
                    server: ipqsData.server ?? null,
                    ip_address: ipqsData.ip_address ?? null,
                    dns_valid: ipqsData.dns_valid ?? null,
                    parking: ipqsData.parking ?? null
                  };
                  sourcesChecked.push('IPQualityScore URL scanner');
                  if (ipqsData.risk_score >= 75 || ipqsData.malware === true || ipqsData.phishing === true || ipqsData.spamming === true || ipqsData.suspicious === true) {
                    lookupStatus = 'match_found';
                  } else if (ipqsData.risk_score != null && (lookupStatus === 'unavailable' || lookupStatus === 'no_service')) {
                    lookupStatus = 'no_match';
                  }
                  console.log('[ai-triage] IPQS URL result — risk_score:', ipqsData.risk_score, '| phishing:', ipqsData.phishing);
                } else {
                  console.error('[ai-triage] IPQS URL returned success=false:', ipqsData.message || 'unknown');
                }
              } else {
                console.error('[ai-triage] IPQS URL HTTP error:', ipqsUrlRes.status);
              }
            } catch (ipqsErr) {
              console.error('[ai-triage] IPQS URL lookup error (non-blocking):', ipqsErr.message || ipqsErr);
            }
          }
        } else {
          console.log('[ai-triage] No IPQS_API_KEY â€” skipping external lookup');
          lookupStatus = 'no_service';
        }

        /* 7b. Public complaint source matching (Phone only) */
        let complaintSources = { overall_status: 'unavailable', sources_checked: [], results: [] };
        if (phoneNumber) {
          try {
            const cleanNumber = phoneNumber.replace(/[\s\-()]/g, '');
            const complaintChecks = [
              {
                name: 'who-called.co.uk',
                url: `https://who-called.co.uk/Number/${encodeURIComponent(cleanNumber)}`,
                matchIndicator: (html) => {
                  if (!html) return null;
                  const lower = html.toLowerCase();
                  if (lower.includes('no reports') || lower.includes('not found') || lower.includes('404')) return { found: false };
                  if (lower.includes('report') || lower.includes('comment') || lower.includes('rating')) {
                    const countMatch = html.match(/(\d+)\s*(?:report|comment|review)/i);
                    return { found: true, count: countMatch ? parseInt(countMatch[1], 10) : null };
                  }
                  return { found: false };
                },
              },
              {
                name: 'tellows.co.uk',
                url: `https://www.tellows.co.uk/num/${encodeURIComponent(cleanNumber)}`,
                matchIndicator: (html) => {
                  if (!html) return null;
                  const lower = html.toLowerCase();
                  if (lower.includes('no comments') || lower.includes('not found') || lower.includes('404')) return { found: false };
                  const scoreMatch = html.match(/tellows\s*score[:\s]*(\d+)/i);
                  const commentMatch = html.match(/(\d+)\s*(?:comment|report|rating)/i);
                  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
                  const hasComplaints = (score && score >= 6) || (commentMatch && parseInt(commentMatch[1], 10) > 0);
                  return { found: !!hasComplaints, score, count: commentMatch ? parseInt(commentMatch[1], 10) : null };
                },
              },
            ];

            console.log('[ai-triage] Step 5b: Checking complaint sources for:', cleanNumber);
            const complaintResults = await Promise.allSettled(
              complaintChecks.map(async (source) => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 4000);
                try {
                  const resp = await fetch(source.url, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'SecondLookProtect/1.0 SafeguardingBot' },
                    redirect: 'follow',
                  });
                  clearTimeout(timeout);
                  if (!resp.ok) return { source: source.name, status: 'unavailable', url: source.url };
                  const html = await resp.text();
                  const indicator = source.matchIndicator(html);
                  if (!indicator) return { source: source.name, status: 'unavailable', url: source.url };
                  return {
                    source: source.name,
                    status: indicator.found ? 'match_found' : 'no_match',
                    url: source.url,
                    complaint_count: indicator.count || null,
                    score: indicator.score || null,
                    summary: indicator.found
                      ? `${indicator.count ? indicator.count + ' reports' : 'Reports'} found on ${source.name}${indicator.score ? ` (score: ${indicator.score}/10)` : ''}`
                      : `No complaints found on ${source.name}`,
                  };
                } catch {
                  clearTimeout(timeout);
                  return { source: source.name, status: 'unavailable', url: source.url };
                }
              })
            );

            const cResults = complaintResults.map((r) => r.status === 'fulfilled' ? r.value : { source: 'unknown', status: 'unavailable' });
            const anyMatch = cResults.some((r) => r.status === 'match_found');
            const allUnavailable = cResults.every((r) => r.status === 'unavailable');

            complaintSources = {
              overall_status: anyMatch ? 'match_found' : allUnavailable ? 'unavailable' : 'no_match',
              sources_checked: cResults.map((r) => r.source),
              results: cResults,
            };
            sourcesChecked.push(...cResults.filter((r) => r.status !== 'unavailable').map((r) => r.source));
            console.log('[ai-triage] Complaint source results:', JSON.stringify(complaintSources.results.map((r) => `${r.source}:${r.status}`)));
          } catch (compErr) {
            console.error('[ai-triage] Complaint source check error (non-blocking):', compErr.message || compErr);
          }
        }

        /* 7b-web. Web search corroboration — always attempt when observable exists */
        let webCorroboration = { status: 'not_performed', summary: null, sources: [], search_performed: false };

        try {
          /* Build multi-variant search query for better coverage */
          let searchQueriesParts = [];
          let cleanNum = '';
          if (phoneNumber) {
            cleanNum = phoneNumber.replace(/[\s\-()]/g, '');
            const spacedNum = phoneNumber.trim();
            const plus44 = cleanNum.startsWith('0') ? '+44' + cleanNum.slice(1) : cleanNum;
            searchQueriesParts.push(`"${spacedNum}" scam OR fraud OR complaint OR "who called"`);
            searchQueriesParts.push(`"${cleanNum}" scam OR fraud OR complaint`);
          }
          if (senderEmail) {
            searchQueriesParts.push(`"${senderEmail}" scam OR fraud OR phishing OR complaint`);
          }
          if (urlObj) {
            const cleanUrlHost = (() => { try { return new URL(urlObj).hostname.replace(/^www\./, ''); } catch { return urlObj; } })();
            searchQueriesParts.push(`"${cleanUrlHost}" scam OR fraud OR phishing OR complaint OR malicious`);
          }
          if (isOcrEmail && extractedEntities) {
            const brands = extractedEntities.brands?.join(' OR ') || '';
            const claims = extractedEntities.claims?.join(' OR ') || '';
            if (brands) {
              searchQueriesParts.push(`"${brands}" scam OR phishing OR fake email`);
              if (claims) searchQueriesParts.push(`"${brands}" "${claims}" scam OR phishing`);
            }
          }

          /* Extract case context keywords for targeted searching. Only run if we actually have observables. */
          const caseDesc = (caseRow.description || '') + ' ' + JSON.stringify(caseRow.meta?.details || '');
          const contextMatch = caseDesc.match(/(?:British Gas|BT|Sky|HMRC|Amazon|Royal Mail|Post Office|DPD|Hermes|DHL|PayPal|Microsoft|Apple|NHS|police|council|energy|utility|insurance|bank)/i);
          const contextHint = contextMatch ? contextMatch[0] : '';

          if (contextHint) {
            if (phoneNumber) searchQueriesParts.push(`"${phoneNumber.trim()}" ${contextHint}`);
            if (senderEmail) searchQueriesParts.push(`"${senderEmail}" ${contextHint}`);
            if (urlObj) {
              const cleanUrlHost = (() => { try { return new URL(urlObj).hostname.replace(/^www\./, ''); } catch { return urlObj; } })();
              searchQueriesParts.push(`"${cleanUrlHost}" ${contextHint}`);
            }
            if (isOcrEmail && extractedEntities) {
              const brands = extractedEntities.brands?.join(' OR ') || '';
              if (brands) searchQueriesParts.push(`"${brands}" ${contextHint}`);
            }
          }

          const searchQueries = searchQueriesParts.filter(Boolean).join('\n');

          const primaryObservableText = isOcrEmail ? `reported email screenshot` : phoneNumber ? `phone number: ${phoneNumber}` : senderEmail ? `email address: ${senderEmail}` : `URL/website: ${urlObj}`;
          const searchInputMessage = `Search for public scam reports, fraud reports, complaints, or lookups for the following ${primaryObservableText}. Search using ALL of these formats:

${searchQueriesParts.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Look specifically for:
- Complaint/report sites
- Community forums discussing this exact marker
- Scam warning pages that mention this specific marker
- News articles about this marker

Do NOT count generic advice pages (Action Fraud guidance, Citizens Advice tips, Ofcom general advice, Wikipedia) as evidence.
If you find pages that reference this exact marker with scam/fraud/nuisance/complaint context, list them clearly with URLs.
If you find nothing specific to this marker, say "No specific reports found."
Do not invent findings. Summarise in 2-3 sentences.`;

          console.log('[ai-triage] Web search corroboration starting for observables | context:', contextHint || 'none');
          const webSearchStart = Date.now();
          const webSearchRes = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_KEY}`,
            },
            body: JSON.stringify({
              model: MODEL,
              tools: [{ type: 'web_search_preview' }],
              input: searchInputMessage,
            }),
          });
          const webSearchElapsed = Date.now() - webSearchStart;
          console.log('[ai-triage] Web search completed — status:', webSearchRes.status, '| elapsed:', webSearchElapsed + 'ms');

          if (webSearchRes.ok) {
            const webData = await webSearchRes.json();
            const webMsg = webData.output?.find((i) => i.type === 'message');
            const webText = webMsg?.content?.find((c) => c.type === 'output_text');
            const searchSummary = webText?.text || null;
            const citations = webText?.annotations?.filter((a) => a.type === 'url_citation')?.map((a) => a.url) || [];
            const uniqueCitations = [...new Set(citations)];

            if (searchSummary) {
              /* Check if any citation URL contains the number digits (strong signal) */
              const numberInUrl = uniqueCitations.some((u) => u.includes(cleanNum) || u.includes(cleanNum.replace(/^0/, '')));

              /* Exclude generic advice/guidance sites */
              const genericDomains = /actionfraud|citizensadvice|ofcom|gov\.uk|which\.co\.uk|bbc\.co\.uk\/news|wikipedia/i;
              const nonGenericCitations = uniqueCitations.filter((u) => !genericDomains.test(u));

              /* Broader detection: check for number-specific evidence patterns */
              const hasNumberSpecificEvidence = (
                /reported|complained|scam\s*number|fraud\s*number|nuisance|this number|been reported|received calls|who\s*called|phone\s*lookup|caller\s*id|spam|unwanted|cold\s*call|harassment|warning|dangerous|suspicious\s*call|suspicious\s*number|phishing|vishing|smishing/i.test(searchSummary)
                && !/no (?:number-specific |specific )?reports found|no evidence|no complaints? found|nothing suspicious|no results|could not find/i.test(searchSummary)
              );

              const hasRealSources = nonGenericCitations.length > 0;

              /* Number appearing in a citation URL is strong independent evidence */
              const isCorroborated = (hasNumberSpecificEvidence && hasRealSources) || numberInUrl;

              webCorroboration = {
                status: isCorroborated ? 'corroboration_found' : 'no_corroboration',
                summary: searchSummary,
                sources: uniqueCitations.slice(0, 5),
                search_performed: true,
              };
              console.log('[ai-triage] Web corroboration result:', webCorroboration.status, '| sources:', uniqueCitations.length, '| nonGeneric:', nonGenericCitations.length, '| numberInUrl:', numberInUrl);
            } else {
              webCorroboration = { status: 'no_corroboration', summary: 'Web search returned no relevant results.', sources: [], search_performed: true };
            }
          } else {
            console.error('[ai-triage] Web search API error:', webSearchRes.status);
            webCorroboration = { status: 'unavailable', summary: null, sources: [], search_performed: false };
          }
        } catch (webErr) {
          console.error('[ai-triage] Web search error (non-blocking):', webErr.message || webErr);
          webCorroboration = { status: 'unavailable', summary: null, sources: [], search_performed: false };
        }


        /* 7b-gemini. Gemini corroboration — always-on additional research layer */
        let geminiCorroboration = { status: 'not_performed', summary: null, sources: [], search_performed: false };
        const GEMINI_KEY = process.env.GEMINI_API_KEY;

        if (GEMINI_KEY) {
          try {
            let searchContextText = '';
            let cleanNum = '';
            let searchWordsExtract = [];

            if (phoneNumber) {
              cleanNum = phoneNumber.replace(/[\s\-()]/g, '');
              const spacedNum = phoneNumber.trim();
              const plus44 = cleanNum.startsWith('0') ? '+44' + cleanNum.slice(1) : cleanNum;
              searchContextText = `UK phone number: ${spacedNum} (also try ${cleanNum} and ${plus44}).`;
              searchWordsExtract = [spacedNum, cleanNum, plus44];
            } else if (senderEmail) {
              searchContextText = `email address: ${senderEmail}.`;
              searchWordsExtract = [senderEmail];
            } else if (urlObj) {
              const cleanUrlHost = (() => { try { return new URL(urlObj).hostname.replace(/^www\./, ''); } catch { return urlObj; } })();
              searchContextText = `website or domain: ${cleanUrlHost} (or ${urlObj}).`;
              searchWordsExtract = [cleanUrlHost, urlObj];
            } else if (isOcrEmail && extractedEntities) {
              const brands = extractedEntities.brands?.join(' or ') || 'the sender';
              const claims = extractedEntities.claims?.join(' and ') || 'the claims';
              searchContextText = `email screenshot claiming to be from ${brands} regarding ${claims}.`;
              searchWordsExtract = extractedEntities.brands || [];
              if (extractedEntities.claims) searchWordsExtract.push(...extractedEntities.claims);
            }

            const caseDesc = (caseRow.description || '') + ' ' + JSON.stringify(caseRow.meta?.details || '');
            const contextMatch = caseDesc.match(/(?:British Gas|BT|Sky|HMRC|Amazon|Royal Mail|Post Office|DPD|Hermes|DHL|PayPal|Microsoft|Apple|NHS|police|council|energy|utility|insurance|bank)/i);
            const contextHint = contextMatch ? contextMatch[0] : '';

            if (contextHint) searchContextText += ` The marker may be associated with ${contextHint}.`;

            const GEMINI_MODEL = 'gemini-2.5-flash';
            const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
            console.log('[ai-triage] Gemini corroboration starting for observables | model:', GEMINI_MODEL, '| GEMINI_API_KEY present:', !!GEMINI_KEY);
            const geminiStart = Date.now();
            const geminiRes = await fetch(
              geminiEndpoint,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: `Search for public scam reports, fraud reports, complaints, or lookups for the ${searchContextText}

Look specifically for:
- Complaint/report sites
- Community forums discussing this exact marker
- Scam warning pages mentioning this specific marker
- News articles about this marker

Classify your findings:
- "direct_match": You found pages that reference THIS EXACT marker (${searchWordsExtract.join(' or ')}) with scam/fraud/nuisance/complaint context
- "related_match": You found reports about numbers/emails in the same range or domain but not this exact marker
- "generic_only": You only found generic advice pages not specific to this marker
- "no_evidence": You found nothing relevant

Respond in this exact format:
CLASSIFICATION: [one of: direct_match, related_match, generic_only, no_evidence]
SUMMARY: [2-3 sentences summarising what you found, referencing specific sources]
SOURCES: [comma-separated list of relevant URLs found, or "none"]`
                    }]
                  }],
                  tools: [{ google_search: {} }],
                }),
              }
            );
            const geminiElapsed = Date.now() - geminiStart;
            console.log('[ai-triage] Gemini corroboration completed — status:', geminiRes.status, '| model:', GEMINI_MODEL, '| elapsed:', geminiElapsed + 'ms');

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const groundingMeta = geminiData.candidates?.[0]?.groundingMetadata;
              const groundingChunks = groundingMeta?.groundingChunks || [];
              const groundingUrls = groundingChunks.map((c) => c.web?.uri).filter(Boolean);
              const allUrls = [...new Set(groundingUrls)];

              /* Parse classification from response */
              const classMatch = geminiText.match(/CLASSIFICATION:\s*(direct_match|related_match|generic_only|no_evidence)/i);
              const classification = classMatch ? classMatch[1].toLowerCase() : 'no_evidence';
              const summaryMatch = geminiText.match(/SUMMARY:\s*(.+?)(?=\nSOURCES:|$)/is);
              const geminiSummary = summaryMatch ? summaryMatch[1].trim() : geminiText.slice(0, 500);

              /* Also extract inline URLs from SOURCES line */
              const sourcesMatch = geminiText.match(/SOURCES:\s*(.+)/i);
              if (sourcesMatch && sourcesMatch[1].trim() !== 'none') {
                const inlineUrls = sourcesMatch[1].match(/https?:\/\/[^\s,]+/g) || [];
                inlineUrls.forEach((u) => { if (!allUrls.includes(u)) allUrls.push(u); });
              }

              /* Check if observable appears in any grounding URL */
              let numberInUrl = false;
              if (phoneNumber) {
                const cleanNumShort = cleanNum.replace(/^0/, '');
                numberInUrl = allUrls.some((u) => u.includes(cleanNum) || u.includes(cleanNumShort));
              } else if (senderEmail) {
                const emailDomain = senderEmail.split('@')[1];
                numberInUrl = allUrls.some((u) => u.includes(senderEmail) || (emailDomain && u.includes(emailDomain)));
              } else if (urlObj) {
                const cleanUrlHost = (() => { try { return new URL(urlObj).hostname.replace(/^www\./, ''); } catch { return urlObj; } })();
                numberInUrl = allUrls.some((u) => u.includes(cleanUrlHost));
              }

              const isCorroborated = classification === 'direct_match' || numberInUrl;
              const isRelated = classification === 'related_match';

              geminiCorroboration = {
                status: isCorroborated ? 'corroboration_found' : isRelated ? 'related_evidence' : 'no_corroboration',
                classification: classification,
                summary: geminiSummary,
                sources: allUrls.slice(0, 5),
                search_performed: true,
              };
              console.log('[ai-triage] Gemini result:', geminiCorroboration.status, '| classification:', classification, '| sources:', allUrls.length, '| numberInUrl:', numberInUrl);
            } else {
              const errText = await geminiRes.text().catch(() => 'unknown');
              console.error('[ai-triage] Gemini API error:', geminiRes.status, errText);
              geminiCorroboration = { status: 'unavailable', summary: null, sources: [], search_performed: false };
            }
          } catch (gemErr) {
            console.error('[ai-triage] Gemini corroboration error (non-blocking):', gemErr.message || gemErr);
            geminiCorroboration = { status: 'unavailable', summary: null, sources: [], search_performed: false };
          }
        } else {
          console.log('[ai-triage] Gemini corroboration skipped — no GEMINI_API_KEY');
        }

        /* Determine combined lookup status */
        const ipqsMatch = (externalLookup && (externalLookup.fraud_score >= 75 || externalLookup.recent_abuse === true || externalLookup.risky === true || externalLookup.spammer === true)) ||
          (externalEmailLookup && (externalEmailLookup.fraud_score >= 75 || externalEmailLookup.recent_abuse === true || externalEmailLookup.suspect === true)) ||
          (externalUrlLookup && (externalUrlLookup.risk_score >= 75 || externalUrlLookup.malware === true || externalUrlLookup.phishing === true || externalUrlLookup.spamming === true || externalUrlLookup.suspicious === true));
        const complaintMatch = complaintSources.overall_status === 'match_found';
        const webMatch = webCorroboration.status === 'corroboration_found';
        const geminiMatch = geminiCorroboration.status === 'corroboration_found';
        if (ipqsMatch || complaintMatch || webMatch || geminiMatch) {
          lookupStatus = 'match_found';
        } else if (externalLookup || externalEmailLookup || externalUrlLookup || complaintSources.overall_status === 'no_match') {
          lookupStatus = 'no_match';
        }

        /* 7c. AI interpretation of all signal layers with evidence-weighted scoring */
        const intelSystemPrompt = urlObj ? `You are a safeguarding intelligence analyst for UK care homes. You interpret URL/website data from multiple sources alongside safeguarding case context to produce a structured, evidence-led operational report.

CRITICAL REPORTING RULES:
1. Primary Focus: Your report MUST be grounded explicitly in the exact submitted URL and the actual provider findings (IPQS, Web Search, Gemini).
2. No Generic Advice: Do not produce a generic chatbot answer or general phishing education. Write a concrete, case-specific safeguarding triage report.
3. Open-Source Data is Supporting Only: Make public/open-source information supportive only. It should strengthen the report but not dominate or replace the technical findings for the specific URL.
4. Structure exact fields as follows:
   - "number_risk_assessment": Start with "Item reviewed: [Exact URL]". Then list "Checks performed: [list providers attempted]". Then evaluate the domain itself.
   - "source_findings_summary": Start with "Summary finding: ". Provide a factual summary of what the sources (IPQS, Web, Gemini) actually returned for this exact URL. Explicitly list IPQS reputation/risk findings as primary evidence if available.
   - "ai_assessment": Start with "Safeguarding concern: ". Explain the holistic risk of this URL within the case context.
   - "limitations": State "Confidence / limitations: " followed by what was checked, what was NOT, and if fallback explicit logic had to be used because structured data was weak.
5. Safe Fallbacks: If all providers give weak or generic output, do not invent data. State clearly that the URL has "No significant external threat footprint" and base the assessment purely on the case context and URL structure.

SCORING CALIBRATION - follow these rules strictly:
- Score 0-20 (Low concern): Technical signals are benign (risk_score < 30, no malware/phishing) AND no web corroboration AND case context is weak.
- Score 20-40 (Uncertain): Limited evidence. Technical signals are mostly benign but some minor flags. No direct web corroboration.
- Score 40-60 (Suspicious): At least one moderate signal (risk_score 30-74, or case describes money/data sharing) but no strong direct web corroboration.
- Score 60-80 (High concern): Elevated risk_score + web corroboration OR highly deceptive domain targeting a known institution.
- Score 80-100 (Very high concern): Strong evidence across layers (risk_score >= 75, or malware/phishing=true, or direct domain-specific web corroboration, combined with case involving credentials or money).

INSTITUTIONAL DOMAIN HANDLING - CRITICAL:
- If IPQS shows the domain as valid with low risk score, AND it IS the official corporate domain (e.g. gov.uk, nhs.uk), do NOT automatically conclude the domain itself is malicious.
- Consider: (a) the URL may contain malicious path parameters, (b) the institution's site may be compromised.
- Distinguish closely between a deceptive "typosquatting" domain (e.g., hrnc-gov.uk) and the real domain.

EVIDENCE STRENGTH - classify the evidence:
- "moderate_related": Web search references related infrastructure or similar scams, but not this exact domain.
- "weak_generic": Only generic advice pages or general phishing guidance found - NOT domain-specific.
- "none": No external evidence found beyond technical signals and case context.`
          : isOcrEmail ? `You are a safeguarding intelligence analyst for UK care homes. You interpret an uploaded suspicious email screenshot containing OCR-extracted text, alongside any targeted research performed based on entities found within that text. Produce a structured, evidence-led operational report.

CRITICAL REPORTING RULES:
1. Primary Focus: Your report MUST be grounded explicitly in what the extracted OCR text actually says (the claims, the sender, the branding) AND the actual provider findings from Web Search and Gemini.
2. No Generic Advice: Do not produce a generic educational essay on how to spot phishing. Write a concrete, case-specific safeguarding triage report explaining what THIS specific email appears to be doing.
3. Open-Source Data is Supporting Only: Make public research supportive. Use it to confirm if this is a known scam pattern.
4. Structure exact fields as follows:
   - "number_risk_assessment": Start with "Item reviewed: Reported email screenshot". Then list "Checks performed: OCR text extraction, [list research providers attempted]". Then evaluate the email content itself.
   - "source_findings_summary": Start with "Context from available checks: ". Provide a factual summary of what the targeted research found regarding the claims/brands in the email.
   - "ai_assessment": Start with "Safeguarding concern: ". Explain the holistic risk of this email within the case context. Is it trying to steal credentials? Demand payment? 
   - "limitations": State "Confidence / limitations: " followed by what was checked, what was NOT, and whether the text extraction quality affected the assessment.
5. Safe Fallbacks: If research yields no results, base your entire assessment purely on the extracted OCR text and case context.

EVIDENCE STRENGTH - classify the evidence:
- "strong_direct": Research explicitly reports THIS EXACT email campaign/claim as malicious.
- "moderate_related": Research references similar scams targeting the same brand.
- "weak_generic": Only general phishing guidance found.
- "none": No external evidence found; assessment based purely on OCR text analysis.`
            : `You are a safeguarding intelligence analyst for UK care homes. You interpret marker data (phone numbers and emails) from multiple sources alongside safeguarding case context, and produce an evidence-weighted scam-likelihood score.

SCORING CALIBRATION â€” follow these rules strictly:
- Score 0-20 (Low concern): Technical signals are benign (fraud_score < 30, no VOIP, no abuse, no spammer flag) AND no complaint-source matches AND no web corroboration AND case context is weak.
- Score 20-40 (Uncertain): Limited evidence. Technical signals are mostly benign but some minor flags. No complaint matches. No web corroboration. Case context is ambiguous.
- Score 40-60 (Suspicious): At least one moderate signal (fraud_score 30-74, or VOIP=true, or suspect email, or case describes money/data sharing) but no strong direct corroboration from complaints or web search.
- Score 60-80 (High concern): Multiple signals align (elevated fraud_score + direct complaint matches or web corroboration, or VOIP + abuse + case describes financial loss). OR a legitimate-looking marker with strong case evidence suggesting impersonation/spoofing.
- Score 80-100 (Very high concern): Strong evidence across layers (fraud_score >= 75, or recent_abuse/spammer=true, or direct marker-specific complaint matches + web corroboration, combined with case involving money/data loss).

INSTITUTIONAL NUMBER/EMAIL HANDLING â€” CRITICAL:
- Some reported numbers/emails may belong to legitimate institutions (banks, utilities, NHS, councils, charities).
- If IPQS shows the marker as valid/active with a known carrier/domain and low fraud score, AND it is associated with a recognised institution, do NOT automatically conclude it is a scam marker.
- Instead consider: (a) the caller may have spoofed/impersonated this legitimate marker, (b) the complaint may be about a different marker in the same range/domain, (c) the institution itself may have poor practices.
- Use wording like: "This incident presents concern and may involve impersonation or spoofing of a legitimate institutional marker. Verify only through official contact channels."
- Do NOT say "this marker is a confirmed scam" when it belongs to a known legitimate institution â€” say "the reported incident warrants investigation" and flag possible spoofing.

EVIDENCE STRENGTH â€” classify the evidence:
- "strong_direct": Complaint reports or web search results reference THIS EXACT marker with specific scam/fraud/nuisance reports.
- "moderate_related": Complaint reports or web search reference markers in the SAME RANGE/PREFIX/DOMAIN or related markers, but not this exact marker.
- "weak_generic": Only generic advice pages or general scam-type guidance found â€” NOT marker-specific.
- "none": No external evidence found beyond technical signals and case context.

CRITICAL RULES:
- Do NOT default to 50-70% when evidence is weak â€” if signals are benign and no complaints/web corroboration exist, score below 30.
- Do NOT imply a marker is legitimate solely because it is freephone, landline, or has a low fraud score â€” always consider case context.
- If direct complaint-source matches or web corroboration exist for THIS EXACT marker, this is significant evidence â€” increase the score meaningfully.
- If evidence is only from related markers or same-domain/prefix, treat it as weaker supporting context.
- Do NOT let complaint reports alone overrule all other evidence â€” consider the possibility of spoofing or disputed marker legitimacy.
- ALWAYS explain which specific evidence factors drove the score.

Important:
- You are interpreting source-backed findings, not inventing data.
- Distinguish whether evidence is about THIS exact marker or related markers.
- If spoofing is possible, say so clearly.
- Use professional intelligence-analyst wording.
- Do not identify specific offenders.
- Do not claim legal certainty.
- Always recommend human verification and official-channel verification where relevant.`;

        const externalDataBlock = externalLookup
          ? `\nTechnical phone reputation lookup was performed via IPQualityScore.\nResults:\n${JSON.stringify(externalLookup, null, 2)}`
          : '';

        const externalEmailDataBlock = externalEmailLookup
          ? `\nTechnical email reputation lookup was performed via IPQualityScore.\nResults:\n${JSON.stringify(externalEmailLookup, null, 2)}`
          : '';

        const externalUrlDataBlock = externalUrlLookup
          ? `\nTechnical URL/Domain reputation lookup was performed via IPQualityScore.\nResults:\n${JSON.stringify(externalUrlLookup, null, 2)}`
          : '';

        const complaintDataBlock = complaintSources.overall_status !== 'unavailable'
          ? `\nPublic complaint source checks were performed.\nSources checked: ${complaintSources.sources_checked.join(', ')}\nResults:\n${JSON.stringify(complaintSources.results.filter((r) => r.status !== 'unavailable'), null, 2)}`
          : '';

        const webDataBlock = webCorroboration.search_performed
          ? `\nWeb search corroboration was performed for this marker.\nStatus: ${webCorroboration.status}\nFindings: ${webCorroboration.summary}${webCorroboration.sources.length > 0 ? '\nSources: ' + webCorroboration.sources.join(', ') : ''}`
          : '\nNo web search corroboration was performed.';

        const geminiDataBlock = geminiCorroboration.search_performed
          ? `\nGemini corroboration (Google Search grounding) was also performed.\nStatus: ${geminiCorroboration.status}\nClassification: ${geminiCorroboration.classification || 'unknown'}\nFindings: ${geminiCorroboration.summary}${geminiCorroboration.sources.length > 0 ? '\nSources: ' + geminiCorroboration.sources.join(', ') : ''}`
          : '\nNo Gemini corroboration was performed.';

        const intelUserPrompt = urlObj ? `Assess the following reported URL from a safeguarding case. Generate a structured operational report as instructed.

Reported details: 
URL: ${urlObj}
${externalUrlDataBlock}
${webDataBlock}
${geminiDataBlock}

Case context:
${JSON.stringify({ submission_type: caseRow.submission_type || null, description: caseRow.description || null, meta_details: caseRow.meta?.details || null }, null, 2)}

Respond with JSON matching this exact shape:
{
  "scam_likelihood_score": 0,
  "scam_likelihood_label": "One of: Low concern, Uncertain, Suspicious, High concern, Very high concern",
  "scam_likelihood_explanation": "2-3 sentences explaining evidence factors. Distinguish direct vs related evidence. Note typo-squatting or impersonation.",
  "evidence_strength": "One of: strong_direct, moderate_related, weak_generic, none",
  "spoofing_assessment": "One of: likely_legitimate, possible_spoofing, unlikely_spoofing, not_applicable. Explain briefly.",
  "number_risk_assessment": "Start with 'Item reviewed: [Exact URL]. Checks performed: [Providers]'. Then 1-2 sentences on the URL/Domain itself.",
  "source_findings_summary": "Start with 'Summary finding: '. Summarise ALL source findings factually using explicit check data.",
  "ai_assessment": "Start with 'Safeguarding concern: '. Interpret holistic risk of this URL within the case context.",
  "risk_indicators": ["Short factual bullet points combining all evidence layers tied EXPLICITLY to the URL"],
  "pattern_match": "Whether signals match known scam patterns (e.g. phishing). Include impersonation if relevant. N/A if none.",
  "recommended_actions": ["1-3 next steps. Include safe verification methods."],
  "limitations": "Start with 'Confidence / limitations: '. State what was checked, what was NOT, and whether evidence is direct or indirect."
}`
          : isOcrEmail ? `Assess the following reported email screenshot from a safeguarding case. Generate a structured operational report as instructed, grounded in the extracted text.

Reported details: 
OCR Extracted Text:
"""
${ocrText.slice(0, 1500)}
"""
${webDataBlock}
${geminiDataBlock}

Case context:
${JSON.stringify({ submission_type: caseRow.submission_type || null, description: caseRow.description || null, meta_details: caseRow.meta?.details || null }, null, 2)}

Respond with JSON matching this exact shape:
{
  "scam_likelihood_score": 0,
  "scam_likelihood_label": "One of: Low concern, Uncertain, Suspicious, High concern, Very high concern",
  "scam_likelihood_explanation": "2-3 sentences explaining the primary deception mechanism seen in the OCR text and any supporting research.",
  "evidence_strength": "One of: strong_direct, moderate_related, weak_generic, none",
  "spoofing_assessment": "not_applicable",
  "number_risk_assessment": "Start with 'Item reviewed: Reported email screenshot'. Then 'Checks performed: OCR text extraction, Web Search, Gemini'. Then 1-2 sentences on the email's intent.",
  "source_findings_summary": "Start with 'Context from available checks: '. Summarise research findings regarding the brands/claims.",
  "ai_assessment": "Start with 'Safeguarding concern: '. Interpret holistic risk of this email.",
  "risk_indicators": ["Short factual bullet points explicitly listing the deceptive claims, urgency, or suspicious links seen in the text"],
  "pattern_match": "The specific phishing/scam pattern (e.g., 'Payment failure notification', 'Account verification phishing').",
  "recommended_actions": ["1-3 next steps. Include safe verification methods."],
  "limitations": "Start with 'Confidence / limitations: '. Note if the OCR text was partial or if research only found generic matches."
}`
            : `Assess the following reported marker from a safeguarding case. Consider whether this marker may belong to a legitimate institution and whether the incident could involve spoofing or impersonation.

Reported details: 
${phoneNumber ? `Phone: ${phoneNumber}\n` : ''}${senderEmail ? `Email: ${senderEmail}\n` : ''}
${externalDataBlock}
${externalEmailDataBlock}
${complaintDataBlock}
${webDataBlock}
${geminiDataBlock}

Case context:
${JSON.stringify({ submission_type: caseRow.submission_type || null, description: caseRow.description || null, meta_details: caseRow.meta?.details || null }, null, 2)}

Respond with JSON matching this exact shape:
{
  "scam_likelihood_score": 0,
  "scam_likelihood_label": "One of: Low concern, Uncertain, Suspicious, High concern, Very high concern",
  "scam_likelihood_explanation": "2-3 sentences explaining evidence factors. Distinguish direct vs related-number evidence. Note any spoofing possibility.",
  "evidence_strength": "One of: strong_direct, moderate_related, weak_generic, none",
  "spoofing_assessment": "One of: likely_legitimate, possible_spoofing, unlikely_spoofing, not_applicable. Explain briefly.",
  "number_risk_assessment": "1-2 sentences on the marker itself separate from the incident.",
  "source_findings_summary": "2-3 sentences summarising ALL source findings factually.",
  "ai_assessment": "2-3 sentences interpreting what all combined signals mean. Flag spoofing if possible.",
  "risk_indicators": ["Short factual bullet points combining all evidence layers"],
  "pattern_match": "Whether signals match known scam patterns. Include spoofing/impersonation if relevant. N/A if none.",
  "recommended_actions": ["1-3 next steps. Include official-channel verification if institutional marker suspected."],
  "limitations": "State what was checked, what was NOT, and whether evidence is direct or indirect."
}`;

        console.log('[ai-triage] OpenAI number-intel request starting â€” model:', MODEL, '| OPENAI_API_KEY present:', !!OPENAI_KEY);
        const intelOpenaiStart = Date.now();
        const intelOpenaiRes = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_KEY}`,
          },
          body: JSON.stringify({
            model: MODEL,
            input: [
              { role: 'system', content: intelSystemPrompt },
              { role: 'user', content: intelUserPrompt },
            ],
            text: {
              format: {
                type: 'json_schema',
                name: 'number_intelligence',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    scam_likelihood_score: { type: 'integer' },
                    scam_likelihood_label: { type: 'string' },
                    scam_likelihood_explanation: { type: 'string' },
                    evidence_strength: { type: 'string' },
                    spoofing_assessment: { type: 'string' },
                    number_risk_assessment: { type: 'string' },
                    source_findings_summary: { type: 'string' },
                    ai_assessment: { type: 'string' },
                    risk_indicators: { type: 'array', items: { type: 'string' } },
                    pattern_match: { type: 'string' },
                    recommended_actions: { type: 'array', items: { type: 'string' } },
                    limitations: { type: 'string' },
                  },
                  required: [
                    'scam_likelihood_score', 'scam_likelihood_label', 'scam_likelihood_explanation',
                    'evidence_strength', 'spoofing_assessment', 'number_risk_assessment',
                    'source_findings_summary', 'ai_assessment', 'risk_indicators',
                    'pattern_match', 'recommended_actions', 'limitations',
                  ],
                  additionalProperties: false,
                },
              },
            },
          }),
        });

        const intelOpenaiElapsed = Date.now() - intelOpenaiStart;
        if (intelOpenaiRes.ok) {
          console.log('[ai-triage] OpenAI number-intel request completed â€” status:', intelOpenaiRes.status, '| elapsed:', intelOpenaiElapsed + 'ms', '| model:', MODEL);
          const intelData = await intelOpenaiRes.json();
          let intelOutput;
          try {
            const tc = intelData.output?.find((i) => i.type === 'message')?.content?.find((c) => c.type === 'output_text');
            intelOutput = JSON.parse(tc?.text || '{}');
            console.log('[ai-triage] OpenAI number-intel parsed successfully â€” keys:', Object.keys(intelOutput).join(', '), '| scam_score:', intelOutput.scam_likelihood_score ?? 'N/A');
          } catch (parseErr) {
            console.error('[ai-triage] âœ– OpenAI number-intel parse FAILED:', parseErr.message || parseErr);
            intelOutput = null;
          }

          if (urlObj && intelOutput) {
            const referencedExactUrl = intelOutput.number_risk_assessment?.includes(urlObj) || intelOutput.source_findings_summary?.includes(urlObj) || intelOutput.ai_assessment?.includes(urlObj);
            console.log(`[url-intel-report] Final report referenced exact URL: ${referencedExactUrl}`);
            const fallbackUsed = intelOutput.evidence_strength === 'none' || intelOutput.evidence_strength === 'weak_generic';
            console.log(`[url-intel-report] Fallback reporting logic used (weak evidence): ${fallbackUsed}`);
            console.log(`[url-intel-report] Providers attempted: IPQS (${externalUrlLookup ? 'Success' : 'Fail/Unavailable'}), Web Search (${webCorroboration.search_performed ? 'Success' : 'Fail/Unavailable'}), Gemini (${geminiCorroboration.search_performed ? 'Success' : 'Fail/Unavailable'})`);
          }

          if (isOcrEmail && intelOutput) {
            console.log(`[ocr-intel-report] Provider outputs used in final report (Evidence: ${intelOutput.evidence_strength})`);
            console.log(`[ocr-intel-report] Contextual narrative included: ${!!intelOutput.ai_assessment}`);
          }

          if (intelOutput) {
            const updatedRaw = {
              ...openaiData,
              number_intel: {
                phone_number: phoneNumber ? phoneNumber.trim() : null,
                email_address: senderEmail ? senderEmail.trim() : null,
                lookup_status: lookupStatus,
                sources_checked: sourcesChecked,
                external_lookup: externalLookup,
                external_email_lookup: externalEmailLookup,
                external_url_lookup: externalUrlLookup,
                complaint_sources: complaintSources,
                web_corroboration: webCorroboration,
                gemini_corroboration: geminiCorroboration,
                scam_likelihood: {
                  score: intelOutput.scam_likelihood_score ?? null,
                  label: intelOutput.scam_likelihood_label || null,
                  explanation: intelOutput.scam_likelihood_explanation || null,
                },
                evidence_strength: intelOutput.evidence_strength || null,
                spoofing_assessment: intelOutput.spoofing_assessment || null,
                number_risk_assessment: intelOutput.number_risk_assessment || null,
                source_findings_summary: intelOutput.source_findings_summary || null,
                ai_assessment: intelOutput.ai_assessment || null,
                risk_indicators: intelOutput.risk_indicators || [],
                pattern_match: intelOutput.pattern_match || null,
                recommended_actions: intelOutput.recommended_actions || [],
                limitations: intelOutput.limitations || null,
                external_check_performed: !!externalLookup || !!externalEmailLookup || !!externalUrlLookup,
                complaint_check_performed: complaintSources.overall_status !== 'unavailable',
                web_search_performed: webCorroboration.search_performed,
                gemini_checked: geminiCorroboration.search_performed,
                checked_at: new Date().toISOString(),
              },
            };
            await fetch(`${SUPABASE_URL}/rest/v1/ai_triage_results?id=eq.${encodeURIComponent(triageId)}`, {
              method: 'PATCH',
              headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({ raw_response: updatedRaw }),
            });
            console.log('[ai-triage] âœ” Combined number intelligence saved for case_id:', case_id, '| lookup_status:', lookupStatus, '| web:', webCorroboration.status);
          }
        } else {
          console.error('[ai-triage] âœ– OpenAI number-intel FAILED â€” status:', intelOpenaiRes.status, '| elapsed:', intelOpenaiElapsed + 'ms');
          try { const errBody = await intelOpenaiRes.text(); console.error('[ai-triage] OpenAI number-intel error body:', errBody); } catch { }
        }
      } catch (intelErr) {
        console.error('[ai-triage] âš  Number intelligence error (non-blocking):', intelErr.message || intelErr);
      }
    } else {
      console.log('[ai-triage] No observable markers (phone/email/URL) in case â€” skipping extra intelligence');
    }

    const routePath = (phoneNumber || senderEmail || urlObj) && triageId ? 'triage + extracted intelligence' : 'triage only';
    console.log('[ai-triage] âœ” Route completed â€” path:', routePath, '| case_id:', case_id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[ai-triage] âœ– Unexpected error:', err.message || err);
    console.error('[ai-triage] Stack:', err.stack || 'N/A');
    return res.status(500).json({ ok: false, error: err.message || 'Unknown error', step: 'unexpected' });
  }
}

/* ── Entity extraction from OCR text ─────────────────────────────────────── */
function extractEntitiesFromText(text) {
  if (!text || typeof text !== 'string') return null;

  const entities = {};
  const t = text;

  // Domains and URLs
  const domainMatches = t.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?)/gi);
  if (domainMatches?.length) {
    entities.domains = [...new Set(domainMatches.map(d => d.trim()))];
  }

  // Brand / service names (common impersonation targets)
  const brandPatterns = /\b(Ledger|Coinbase|Binance|MetaMask|Trezor|PayPal|Amazon|Microsoft|Apple|Google|BT|HMRC|Royal Mail|Post Office|DHL|FedEx|Hermes|Evri|DPD|Barclays|Lloyds|HSBC|NatWest|Santander|Halifax|Nationwide|Visa|Mastercard|Bank of England|Action Fraud|NHS|DVLA)\b/gi;
  const brands = t.match(brandPatterns);
  if (brands?.length) {
    entities.brandNames = [...new Set(brands.map(b => b.trim()))];
  }

  // Wallet / security / payment / crypto language
  const walletPatterns = /\b(wallet|seed phrase|recovery phrase|private key|validate|verification|crypto|bitcoin|ethereum|blockchain|token|authentication|two-factor|2fa|secure your|protect your account|unauthorized access|compromised|breach|suspended|locked|frozen|deactivat)\w*\b/gi;
  const walletMatches = t.match(walletPatterns);
  if (walletMatches?.length) {
    entities.walletSecurityLanguage = [...new Set(walletMatches.map(w => w.trim().toLowerCase()))];
  }

  // QR code references
  const qrPatterns = /\b(QR\s*code|scan\s*(this|the|below|above)|point your (camera|phone)|scan with|download.*app.*scan)\b/gi;
  const qrMatches = t.match(qrPatterns);
  if (qrMatches?.length) {
    entities.qrReferences = [...new Set(qrMatches.map(q => q.trim()))];
  }

  // Urgency / pressure language
  const urgencyPatterns = /\b(immediately|urgent|within \d+ (hours?|days?|minutes?)|act now|time.?sensitive|expires?|deadline|limited time|final (notice|warning)|do not delay|failure to|will result in|permanent(ly)?|irrevocabl[ey]|at risk|must be completed)\b/gi;
  const urgencyMatches = t.match(urgencyPatterns);
  if (urgencyMatches?.length) {
    entities.urgencyLanguage = [...new Set(urgencyMatches.map(u => u.trim().toLowerCase()))];
  }

  // Impersonation cues
  const impersonationPatterns = /\b(official|authorized|authorised|certified|registered|verified|genuine|legitimate|approved|compliance|regulatory|mandatory|required by law|legal requirement|government|department of|customer (service|support|care)|help\s*desk|support team|security team|fraud team|technical support)\b/gi;
  const impersonationMatches = t.match(impersonationPatterns);
  if (impersonationMatches?.length) {
    entities.impersonationCues = [...new Set(impersonationMatches.map(i => i.trim().toLowerCase()))];
  }

  // Contact info (phone numbers, email addresses)
  const phoneMatches = t.match(/(?:\+?\d{1,4}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g);
  const emailMatches = t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  const contactInfo = [];
  if (phoneMatches?.length) contactInfo.push(...phoneMatches.map(p => p.trim()));
  if (emailMatches?.length) contactInfo.push(...emailMatches.map(e => e.trim()));
  if (contactInfo.length) {
    entities.contactInfo = [...new Set(contactInfo)];
  }

  // Return null if nothing was found
  const hasEntities = Object.keys(entities).length > 0;
  return hasEntities ? entities : null;
}
