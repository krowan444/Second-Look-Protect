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
- Respond with valid JSON only matching the required schema.`;

    const userPrompt = `Triage the following safeguarding case. Base your analysis strictly on the submitted case details below.

Case data:
${JSON.stringify(caseContext, null, 2)}

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

- "human_review_required": Always true.`;



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
              },
              required: [
                'summary', 'risk_level', 'suggested_category', 'suggested_urgency',
                'likely_scam_pattern', 'actions', 'indicators', 'confidence',
                'repeat_targeting_suspected', 'financial_harm_indicator', 'human_review_required',
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

    /* Flag number intel as pending if phone number exists (cleared by PATCH after pipeline completes) */
    const phoneNumberEarly = caseRow.meta?.details?.phone_number || caseRow.meta?.details?.sender || null;
    if (phoneNumberEarly) {
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

    /* 7. Automatically run source-backed number intelligence if phone number exists */
    const phoneNumber = caseRow.meta?.details?.phone_number || caseRow.meta?.details?.sender || null;
    if (phoneNumber && triageId) {
      console.log('[ai-triage] Step 5: Phone number found, running source-backed number intelligence:', phoneNumber);
      try {
        const IPQS_KEY = process.env.IPQS_API_KEY;
        let externalLookup = null;
        let lookupStatus = 'unavailable';
        let sourcesChecked = [];

        /* 7a. External phone reputation lookup via IPQualityScore */
        if (IPQS_KEY) {
          try {
            const cleanNumber = phoneNumber.replace(/[\s\-()]/g, '');
            const ipqsUrl = `https://ipqualityscore.com/api/json/phone/${encodeURIComponent(IPQS_KEY)}/${encodeURIComponent(cleanNumber)}?country[]=GB&country[]=US`;
            console.log('[ai-triage] Calling IPQualityScore for:', cleanNumber);
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
                console.log('[ai-triage] IPQS result â€” fraud_score:', ipqsData.fraud_score, '| recent_abuse:', ipqsData.recent_abuse, '| risky:', ipqsData.risky);
              } else {
                console.error('[ai-triage] IPQS returned success=false:', ipqsData.message || 'unknown');
              }
            } else {
              console.error('[ai-triage] IPQS HTTP error:', ipqsRes.status);
            }
          } catch (ipqsErr) {
            console.error('[ai-triage] IPQS lookup error (non-blocking):', ipqsErr.message || ipqsErr);
          }
        } else {
          console.log('[ai-triage] No IPQS_API_KEY â€” skipping external lookup');
          lookupStatus = 'no_service';
        }

        /* 7b. Public complaint source matching */
        let complaintSources = { overall_status: 'unavailable', sources_checked: [], results: [] };
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

        /* 7b-web. Web search corroboration — always attempt when phone number exists */
        let webCorroboration = { status: 'not_performed', summary: null, sources: [], search_performed: false };

        try {
          /* Build multi-variant search query for better coverage */
          const cleanNum = phoneNumber.replace(/[\s\-()]/g, '');
          const spacedNum = phoneNumber.trim();
          const plus44 = cleanNum.startsWith('0') ? '+44' + cleanNum.slice(1) : cleanNum;

          /* Extract case context keywords for targeted searching */
          const caseDesc = (caseRow.description || '') + ' ' + JSON.stringify(caseRow.meta?.details || '');
          const contextMatch = caseDesc.match(/(?:British Gas|BT|Sky|HMRC|Amazon|Royal Mail|Post Office|DPD|Hermes|DHL|PayPal|Microsoft|Apple|NHS|police|council|energy|utility|insurance|bank)/i);
          const contextHint = contextMatch ? contextMatch[0] : '';

          const searchQueries = [
            `"${spacedNum}" scam OR fraud OR complaint OR "who called"`,
            `"${cleanNum}" scam OR fraud OR complaint`,
            contextHint ? `"${spacedNum}" ${contextHint}` : null,
          ].filter(Boolean).join('\n');

          console.log('[ai-triage] Web search corroboration starting for:', phoneNumber, '| variants:', cleanNum, plus44, '| context:', contextHint || 'none');
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
              input: `Search for public scam reports, fraud reports, complaints, or "who called" lookups for the following UK phone number. Search using ALL of these formats as the number may appear differently on different sites:

1. "${spacedNum}"
2. "${cleanNum}"
3. "${plus44}"
${contextHint ? `4. "${spacedNum}" ${contextHint}` : ''}

Look specifically for:
- Complaint/report sites (e.g. who-called.co.uk, tellows, shouldianswer, whocalledme)
- Community forums discussing this exact number
- Scam warning pages that mention this specific number
- News articles about this number

Do NOT count generic advice pages (Action Fraud guidance, Citizens Advice tips, Ofcom general advice, Wikipedia) as evidence.
If you find pages that reference this exact number with scam/fraud/nuisance/complaint context, list them clearly with URLs.
If you find nothing specific to this number, say "No number-specific reports found."
Do not invent findings. Summarise in 2-3 sentences.`,
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
            const cleanNum = phoneNumber.replace(/[\s\-()]/g, '');
            const spacedNum = phoneNumber.trim();
            const plus44 = cleanNum.startsWith('0') ? '+44' + cleanNum.slice(1) : cleanNum;
            const caseDesc = (caseRow.description || '') + ' ' + JSON.stringify(caseRow.meta?.details || '');
            const contextMatch = caseDesc.match(/(?:British Gas|BT|Sky|HMRC|Amazon|Royal Mail|Post Office|DPD|Hermes|DHL|PayPal|Microsoft|Apple|NHS|police|council|energy|utility|insurance|bank)/i);
            const contextHint = contextMatch ? contextMatch[0] : '';

            const GEMINI_MODEL = 'gemini-2.5-flash';
            const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
            console.log('[ai-triage] Gemini corroboration starting for:', phoneNumber, '| model:', GEMINI_MODEL, '| GEMINI_API_KEY present:', !!GEMINI_KEY);
            const geminiStart = Date.now();
            const geminiRes = await fetch(
              geminiEndpoint,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: `Search for public scam reports, fraud reports, complaints, or "who called" lookups for the UK phone number: ${spacedNum} (also try ${cleanNum} and ${plus44}).${contextHint ? ` The number may be associated with ${contextHint}.` : ''}

Look specifically for:
- Complaint/report sites (who-called.co.uk, tellows, shouldianswer, whocalledme, revealname)
- Community forums discussing this exact number
- Scam warning pages mentioning this specific number
- News articles about this number

Classify your findings:
- "direct_match": You found pages that reference THIS EXACT number (${spacedNum} or ${cleanNum} or ${plus44}) with scam/fraud/nuisance/complaint context
- "related_match": You found reports about numbers in the same range or prefix but not this exact number
- "generic_only": You only found generic advice pages not specific to this number
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

              /* Check if number appears in any grounding URL */
              const cleanNumShort = cleanNum.replace(/^0/, '');
              const numberInUrl = allUrls.some((u) => u.includes(cleanNum) || u.includes(cleanNumShort));

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
        const ipqsMatch = externalLookup && (externalLookup.fraud_score >= 75 || externalLookup.recent_abuse === true || externalLookup.risky === true || externalLookup.spammer === true);
        const complaintMatch = complaintSources.overall_status === 'match_found';
        const webMatch = webCorroboration.status === 'corroboration_found';
        const geminiMatch = geminiCorroboration.status === 'corroboration_found';
        if (ipqsMatch || complaintMatch || webMatch || geminiMatch) {
          lookupStatus = 'match_found';
        } else if (externalLookup || complaintSources.overall_status === 'no_match') {
          lookupStatus = 'no_match';
        }

        /* 7c. AI interpretation of all signal layers with evidence-weighted scoring */
        const intelSystemPrompt = `You are a safeguarding intelligence analyst for UK care homes. You interpret phone number data from multiple sources alongside safeguarding case context, and produce an evidence-weighted scam-likelihood score.

SCORING CALIBRATION â€” follow these rules strictly:
- Score 0-20 (Low concern): Technical signals are benign (fraud_score < 30, no VOIP, no abuse, no spammer flag) AND no complaint-source matches AND no web corroboration AND case context is weak.
- Score 20-40 (Uncertain): Limited evidence. Technical signals are mostly benign but some minor flags. No complaint matches. No web corroboration. Case context is ambiguous.
- Score 40-60 (Suspicious): At least one moderate signal (fraud_score 30-74, or VOIP=true, or case describes money/data sharing) but no strong direct corroboration from complaints or web search.
- Score 60-80 (High concern): Multiple signals align (elevated fraud_score + direct complaint matches or web corroboration, or VOIP + abuse + case describes financial loss). OR a legitimate-looking number with strong case evidence suggesting impersonation/spoofing.
- Score 80-100 (Very high concern): Strong evidence across layers (fraud_score >= 75, or recent_abuse/spammer=true, or direct number-specific complaint matches + web corroboration, combined with case involving money/data loss).

INSTITUTIONAL NUMBER HANDLING â€” CRITICAL:
- Some reported numbers may belong to legitimate institutions (banks, utilities, NHS, councils, charities).
- If IPQS shows the number as valid/active with a known carrier and low fraud score, AND it is associated with a recognised institution, do NOT automatically conclude it is a scam number.
- Instead consider: (a) the caller may have spoofed/impersonated this legitimate number, (b) the complaint may be about a different number in the same range, (c) the institution itself may have poor practices.
- Use wording like: "This incident presents concern and may involve impersonation or spoofing of a legitimate institutional number. Verify only through official contact channels."
- Do NOT say "this number is a confirmed scam" when it belongs to a known legitimate institution â€” say "the reported incident warrants investigation" and flag possible spoofing.

EVIDENCE STRENGTH â€” classify the evidence:
- "strong_direct": Complaint reports or web search results reference THIS EXACT number with specific scam/fraud/nuisance reports.
- "moderate_related": Complaint reports or web search reference numbers in the SAME RANGE/PREFIX or related numbers, but not this exact number.
- "weak_generic": Only generic advice pages or general scam-type guidance found â€” NOT number-specific.
- "none": No external evidence found beyond technical signals and case context.

CRITICAL RULES:
- Do NOT default to 50-70% when evidence is weak â€” if signals are benign and no complaints/web corroboration exist, score below 30.
- Do NOT imply a number is legitimate solely because it is freephone, landline, or has a low fraud score â€” always consider case context.
- If direct complaint-source matches or web corroboration exist for THIS EXACT number, this is significant evidence â€” increase the score meaningfully.
- If evidence is only from related numbers or same-prefix, treat it as weaker supporting context.
- Do NOT let complaint reports alone overrule all other evidence â€” consider the possibility of spoofing or disputed number legitimacy.
- ALWAYS explain which specific evidence factors drove the score.

Important:
- You are interpreting source-backed findings, not inventing data.
- Distinguish whether evidence is about THIS exact number or related numbers.
- If spoofing is possible, say so clearly.
- Use professional intelligence-analyst wording.
- Do not identify specific offenders.
- Do not claim legal certainty.
- Always recommend human verification and official-channel verification where relevant.`;

        const externalDataBlock = externalLookup
          ? `\nTechnical phone reputation lookup was performed via IPQualityScore.\nResults:\n${JSON.stringify(externalLookup, null, 2)}`
          : '\nNo technical phone reputation lookup was performed (service unavailable).';

        const complaintDataBlock = complaintSources.overall_status !== 'unavailable'
          ? `\nPublic complaint source checks were performed.\nSources checked: ${complaintSources.sources_checked.join(', ')}\nResults:\n${JSON.stringify(complaintSources.results.filter((r) => r.status !== 'unavailable'), null, 2)}`
          : '\nNo public complaint source checks were performed (sources unavailable).';

        const webDataBlock = webCorroboration.search_performed
          ? `\nWeb search corroboration was performed for this number.\nStatus: ${webCorroboration.status}\nFindings: ${webCorroboration.summary}${webCorroboration.sources.length > 0 ? '\nSources: ' + webCorroboration.sources.join(', ') : ''}`
          : '\nNo web search corroboration was performed.';

        const geminiDataBlock = geminiCorroboration.search_performed
          ? `\nGemini corroboration (Google Search grounding) was also performed.\nStatus: ${geminiCorroboration.status}\nClassification: ${geminiCorroboration.classification || 'unknown'}\nFindings: ${geminiCorroboration.summary}${geminiCorroboration.sources.length > 0 ? '\nSources: ' + geminiCorroboration.sources.join(', ') : ''}`
          : '\nNo Gemini corroboration was performed.';

        const intelUserPrompt = `Assess the following reported phone number from a safeguarding case. Consider whether this number may belong to a legitimate institution and whether the incident could involve spoofing or impersonation.

Reported number: ${phoneNumber}
${externalDataBlock}
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
  "number_risk_assessment": "1-2 sentences on the number itself separate from the incident.",
  "source_findings_summary": "2-3 sentences summarising ALL source findings factually.",
  "ai_assessment": "2-3 sentences interpreting what all combined signals mean. Flag spoofing if possible.",
  "risk_indicators": ["Short factual bullet points combining all evidence layers"],
  "pattern_match": "Whether signals match known scam patterns. Include spoofing/impersonation if relevant. N/A if none.",
  "recommended_actions": ["1-3 next steps. Include official-channel verification if institutional number suspected."],
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

          if (intelOutput) {
            const updatedRaw = {
              ...openaiData,
              number_intel: {
                phone_number: phoneNumber.trim(),
                lookup_status: lookupStatus,
                sources_checked: sourcesChecked,
                external_lookup: externalLookup,
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
                external_check_performed: !!externalLookup,
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
            console.log('[ai-triage] âœ” Combined number intelligence saved for case_id:', case_id, '| lookup_status:', lookupStatus, '| complaints:', complaintSources.overall_status, '| web:', webCorroboration.status);
          }
        } else {
          console.error('[ai-triage] âœ– OpenAI number-intel FAILED â€” status:', intelOpenaiRes.status, '| elapsed:', intelOpenaiElapsed + 'ms');
          try { const errBody = await intelOpenaiRes.text(); console.error('[ai-triage] OpenAI number-intel error body:', errBody); } catch {}
        }
      } catch (intelErr) {
        console.error('[ai-triage] âš  Number intelligence error (non-blocking):', intelErr.message || intelErr);
      }
    } else {
      console.log('[ai-triage] No phone number in case â€” skipping number intelligence');
    }

    const routePath = phoneNumber && triageId ? 'triage + number intelligence' : 'triage only';
    console.log('[ai-triage] âœ” Route completed â€” path:', routePath, '| case_id:', case_id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[ai-triage] âœ– Unexpected error:', err.message || err);
    console.error('[ai-triage] Stack:', err.stack || 'N/A');
    return res.status(500).json({ ok: false, error: err.message || 'Unknown error', step: 'unexpected' });
  }
}
