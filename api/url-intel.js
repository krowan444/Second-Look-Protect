// /api/url-intel.js — Source-backed URL intelligence (manual re-run)
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    const IPQS_KEY = process.env.IPQS_API_KEY;

    const missing = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!OPENAI_KEY) missing.push('OPENAI_API_KEY');
    if (missing.length > 0) {
        return res.status(500).json({ ok: false, error: `Missing env vars: ${missing.join(', ')}` });
    }

    try {
        const { triage_id, case_id, url } = req.body || {};
        if (!triage_id || !case_id) {
            return res.status(400).json({ ok: false, error: 'triage_id and case_id are required' });
        }
        if (!url || !url.trim()) {
            return res.status(400).json({ ok: false, error: 'url is required' });
        }

        /* 1. Fetch the existing triage row */
        const triageRes = await fetch(
            `${SUPABASE_URL}/rest/v1/ai_triage_results?id=eq.${encodeURIComponent(triage_id)}&limit=1`,
            {
                headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    Accept: 'application/vnd.pgrst.object+json',
                },
            },
        );
        if (!triageRes.ok) {
            const text = await triageRes.text();
            return res.status(500).json({ ok: false, error: `Failed to fetch triage row: ${text}` });
        }
        const triageRow = await triageRes.json();

        /* 2. Fetch case context */
        const caseRes = await fetch(
            `${SUPABASE_URL}/rest/v1/cases?id=eq.${encodeURIComponent(case_id)}&limit=1`,
            {
                headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    Accept: 'application/vnd.pgrst.object+json',
                },
            },
        );
        let caseContext = null;
        if (caseRes.ok) {
            const c = await caseRes.json();
            caseContext = {
                submission_type: c.submission_type || null,
                description: c.description || null,
                meta_details: c.meta?.details || null,
            };
        }

        /* 3. External URL reputation lookup via IPQualityScore */
        let externalUrlLookup = null;
        let lookupStatus = 'unavailable';
        let sourcesChecked = [];

        if (IPQS_KEY) {
            try {
                const encUrl = encodeURIComponent(url);
                const ipqsUrlApi = `https://ipqualityscore.com/api/json/url/${encodeURIComponent(IPQS_KEY)}/${encUrl}`;
                console.log('[url-intel] Calling IPQualityScore for URL:', url);
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
                        if (ipqsData.risk_score >= 75 || ipqsData.malware || ipqsData.phishing || ipqsData.spamming || ipqsData.suspicious) {
                            lookupStatus = 'match_found';
                        } else if (ipqsData.risk_score != null && (lookupStatus === 'unavailable' || lookupStatus === 'no_service')) {
                            lookupStatus = 'no_match';
                        }
                    } else {
                        console.error('[url-intel] IPQS URL returned success=false:', ipqsData.message || 'unknown');
                    }
                }
            } catch (ipqsErr) {
                console.error('[url-intel] IPQS error:', ipqsErr.message || ipqsErr);
            }
        } else {
            lookupStatus = 'no_service';
        }

        // No direct equivalent for 'who-called.co.uk' for URLs, so we skip complaint checks and rely on IPQS, Web, and Gemini.
        let complaintSources = { overall_status: 'unavailable', sources_checked: [], results: [] };

        /* 4b-web. Web search corroboration — always attempt when URL exists */
        let webCorroboration = { status: 'not_performed', summary: null, sources: [], search_performed: false };
        const cleanUrlHost = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();

        try {
            /* Extract case context keywords for targeted searching */
            const caseDesc = (caseContext?.description || '') + ' ' + JSON.stringify(caseContext?.meta_details || '');
            const contextMatch = caseDesc.match(/(?:British Gas|BT|Sky|HMRC|Amazon|Royal Mail|Post Office|DPD|Hermes|DHL|PayPal|Microsoft|Apple|NHS|police|council|energy|utility|insurance|bank)/i);
            const contextHint = contextMatch ? contextMatch[0] : '';

            console.log('[url-intel] Web search corroboration starting for:', url, '| host:', cleanUrlHost, '| context:', contextHint || 'none');
            const webSearchStart = Date.now();
            const webSearchRes = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${OPENAI_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    tools: [{ type: 'web_search_preview' }],
                    input: `Search for public scam reports, fraud reports, phishing warnings, or complaints for the following domain/website. Search using ALL of these formats:

1. "${cleanUrlHost}" scam OR fraud OR phishing OR malicious
${contextHint ? `2. "${cleanUrlHost}" ${contextHint}` : ''}

Look specifically for:
- Threat intelligence reports or URL scanners flagging this exact domain
- Community forums discussing this domain as malicious
- Scam warning pages that mention this domain
- News articles about this domain

Do NOT count generic advice pages (Action Fraud guidance, Citizens Advice tips, Wikipedia) as evidence.
If you find pages that reference this exact domain with scam/fraud/phishing context, list them clearly with URLs.
If you find nothing specific to this domain, say "No specific reports found."
Do not invent findings. Summarise in 2-3 sentences.`,
                }),
            });
            const webSearchElapsed = Date.now() - webSearchStart;
            console.log('[url-intel] Web search completed — status:', webSearchRes.status, '| elapsed:', webSearchElapsed + 'ms');

            if (webSearchRes.ok) {
                const webData = await webSearchRes.json();
                const webMsg = webData.output?.find((i) => i.type === 'message');
                const webText = webMsg?.content?.find((c) => c.type === 'output_text');
                const searchSummary = webText?.text || null;
                const citations = webText?.annotations?.filter((a) => a.type === 'url_citation')?.map((a) => a.url) || [];
                const uniqueCitations = [...new Set(citations)];

                if (searchSummary) {
                    const numberInUrl = uniqueCitations.some((u) => u.includes(cleanUrlHost));

                    const genericDomains = /actionfraud|citizensadvice|ofcom|gov\.uk|which\.co\.uk|bbc\.co\.uk\/news|wikipedia/i;
                    const nonGenericCitations = uniqueCitations.filter((u) => !genericDomains.test(u));

                    const hasNumberSpecificEvidence = (
                        /reported|complained|scam|fraud|phishing|malicious|warning|dangerous|suspicious|threat/i.test(searchSummary)
                        && !/no (?:specific )?reports found|no evidence|no complaints? found|nothing suspicious|no results|could not find/i.test(searchSummary)
                    );

                    const hasRealSources = nonGenericCitations.length > 0;
                    const isCorroborated = (hasNumberSpecificEvidence && hasRealSources) || numberInUrl;

                    webCorroboration = {
                        status: isCorroborated ? 'corroboration_found' : 'no_corroboration',
                        summary: searchSummary,
                        sources: uniqueCitations.slice(0, 5),
                        search_performed: true,
                    };
                    console.log('[url-intel] Web corroboration result:', webCorroboration.status, '| sources:', uniqueCitations.length, '| nonGeneric:', nonGenericCitations.length, '| cleanUrlInUrl:', numberInUrl);
                } else {
                    webCorroboration = { status: 'no_corroboration', summary: 'Web search returned no relevant results.', sources: [], search_performed: true };
                }
            } else {
                console.error('[url-intel] Web search API error:', webSearchRes.status);
                webCorroboration = { status: 'unavailable', summary: null, sources: [], search_performed: false };
            }
        } catch (webErr) {
            console.error('[url-intel] Web search error (non-blocking):', webErr.message || webErr);
            webCorroboration = { status: 'unavailable', summary: null, sources: [], search_performed: false };
        }


        /* 4c-gemini. Gemini corroboration — always-on additional research layer */
        let geminiCorroboration = { status: 'not_performed', summary: null, sources: [], search_performed: false };
        const GEMINI_KEY = process.env.GEMINI_API_KEY;

        if (GEMINI_KEY) {
            try {
                const caseDesc = (caseContext?.description || '') + ' ' + JSON.stringify(caseContext?.meta_details || '');
                const contextMatch = caseDesc.match(/(?:British Gas|BT|Sky|HMRC|Amazon|Royal Mail|Post Office|DPD|Hermes|DHL|PayPal|Microsoft|Apple|NHS|police|council|energy|utility|insurance|bank)/i);
                const contextHint = contextMatch ? contextMatch[0] : '';

                const GEMINI_MODEL = 'gemini-2.5-flash';
                const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
                console.log('[url-intel] Gemini corroboration starting for:', url, '| model:', GEMINI_MODEL, '| GEMINI_API_KEY present:', !!GEMINI_KEY);
                const geminiStart = Date.now();
                const geminiRes = await fetch(
                    geminiEndpoint,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `Search for public scam reports, phishing lists, fraud reports, or threat intelligence for the domain/website: ${cleanUrlHost} (or the full URL: ${url}).${contextHint ? ` The domain may be attempting to impersonate ${contextHint}.` : ''}

Look specifically for:
- Threat intelligence flagging this exact domain
- Community forums discussing this domain
- Scam warning pages mentioning this specific domain
- News articles about this domain

Classify your findings:
- "direct_match": You found pages that reference THIS EXACT domain (${cleanUrlHost}) with scam/fraud/phishing context
- "related_match": You found reports about subdomains or related sites
- "generic_only": You only found generic advice pages
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
                console.log('[url-intel] Gemini corroboration completed — status:', geminiRes.status, '| model:', GEMINI_MODEL, '| elapsed:', geminiElapsed + 'ms');

                if (geminiRes.ok) {
                    const geminiData = await geminiRes.json();
                    const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const groundingMeta = geminiData.candidates?.[0]?.groundingMetadata;
                    const groundingChunks = groundingMeta?.groundingChunks || [];
                    const groundingUrls = groundingChunks.map((c) => c.web?.uri).filter(Boolean);
                    const allUrls = [...new Set(groundingUrls)];

                    const classMatch = geminiText.match(/CLASSIFICATION:\s*(direct_match|related_match|generic_only|no_evidence)/i);
                    const classification = classMatch ? classMatch[1].toLowerCase() : 'no_evidence';
                    const summaryMatch = geminiText.match(/SUMMARY:\s*(.+?)(?=\nSOURCES:|$)/is);
                    const geminiSummary = summaryMatch ? summaryMatch[1].trim() : geminiText.slice(0, 500);

                    const sourcesMatch = geminiText.match(/SOURCES:\s*(.+)/i);
                    if (sourcesMatch && sourcesMatch[1].trim() !== 'none') {
                        const inlineUrls = sourcesMatch[1].match(/https?:\/\/[^\s,]+/g) || [];
                        inlineUrls.forEach((u) => { if (!allUrls.includes(u)) allUrls.push(u); });
                    }

                    const numberInUrl = allUrls.some((u) => u.includes(cleanUrlHost));
                    const isCorroborated = classification === 'direct_match' || numberInUrl;
                    const isRelated = classification === 'related_match';

                    geminiCorroboration = {
                        status: isCorroborated ? 'corroboration_found' : isRelated ? 'related_evidence' : 'no_corroboration',
                        classification: classification,
                        summary: geminiSummary,
                        sources: allUrls.slice(0, 5),
                        search_performed: true,
                    };
                    console.log('[url-intel] Gemini result:', geminiCorroboration.status, '| classification:', classification, '| sources:', allUrls.length);
                } else {
                    const errText = await geminiRes.text().catch(() => 'unknown');
                    console.error('[url-intel] Gemini API error:', geminiRes.status, errText);
                    geminiCorroboration = { status: 'unavailable', summary: null, sources: [], search_performed: false };
                }
            } catch (gemErr) {
                console.error('[url-intel] Gemini corroboration error (non-blocking):', gemErr.message || gemErr);
                geminiCorroboration = { status: 'unavailable', summary: null, sources: [], search_performed: false };
            }
        } else {
            console.log('[url-intel] Gemini corroboration skipped — no GEMINI_API_KEY');
        }

        /* Determine combined lookup status */
        const ipqsMatch = externalUrlLookup && (externalUrlLookup.risk_score >= 75 || externalUrlLookup.malware === true || externalUrlLookup.phishing === true || externalUrlLookup.spamming === true || externalUrlLookup.suspicious === true);
        const webMatch = webCorroboration.status === 'corroboration_found';
        const geminiMatch = geminiCorroboration.status === 'corroboration_found';
        if (ipqsMatch || webMatch || geminiMatch) {
            lookupStatus = 'match_found';
        } else if (externalUrlLookup) {
            lookupStatus = 'no_match';
        }

        /* 5. AI interpretation of all signal layers with evidence-weighted scoring */
        const systemPrompt = `You are a safeguarding intelligence analyst for UK care homes. You interpret URL/website data from multiple sources alongside safeguarding case context to produce a structured, evidence-led operational report.

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
- "strong_direct": IPQS or web search results explicitly flag THIS EXACT domain/URL as malicious, phishing, or scam.
- "moderate_related": Web search references related infrastructure or similar scams, but not this exact domain.
- "weak_generic": Only generic advice pages or general phishing guidance found - NOT domain-specific.
- "none": No external evidence found beyond technical signals and case context.`;

        const externalUrlDataBlock = externalUrlLookup
            ? `\nTechnical URL reputation lookup was performed via IPQualityScore.\nResults:\n${JSON.stringify(externalUrlLookup, null, 2)}`
            : '\nNo technical URL reputation lookup was performed (service unavailable).';

        const webDataBlock = webCorroboration.search_performed
            ? `\nWeb search corroboration was performed for this URL.\nStatus: ${webCorroboration.status}\nFindings: ${webCorroboration.summary}${webCorroboration.sources.length > 0 ? '\nSources: ' + webCorroboration.sources.join(', ') : ''}`
            : '\nNo web search corroboration was performed.';

        const geminiDataBlock = geminiCorroboration.search_performed
            ? `\nGemini corroboration (Google Search grounding) was also performed.\nStatus: ${geminiCorroboration.status}\nClassification: ${geminiCorroboration.classification || 'unknown'}\nFindings: ${geminiCorroboration.summary}${geminiCorroboration.sources.length > 0 ? '\nSources: ' + geminiCorroboration.sources.join(', ') : ''}`
            : '\nNo Gemini corroboration was performed.';

        const userPrompt = `Assess the following reported URL from a safeguarding case. Generate a structured operational report as instructed.

Reported URL: ${url}
${externalUrlDataBlock}
${webDataBlock}
${geminiDataBlock}

Case context:
${caseContext ? JSON.stringify(caseContext, null, 2) : 'No additional case context available.'}

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
}`;

        console.log(`[url-intel-report] Submitted URL: ${url}`);
        console.log(`[url-intel-report] Providers attempted: IPQS (${externalUrlLookup ? 'Success' : 'Fail/Unavailable'}), Web Search (${webCorroboration.search_performed ? 'Success' : 'Fail/Unavailable'}), Gemini (${geminiCorroboration.search_performed ? 'Success' : 'Fail/Unavailable'})`);
        console.log(`[url-intel-report] Provider raw response quality -> IPQS Risk: ${externalUrlLookup?.risk_score ?? 'N/A'}, Web Status: ${webCorroboration.status}, Gemini Status: ${geminiCorroboration.status}`);

        const openaiRes = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                input: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
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

        if (!openaiRes.ok) {
            const errText = await openaiRes.text();
            console.error('[url-intel] OpenAI error:', openaiRes.status, errText);
            return res.status(500).json({ ok: false, error: `OpenAI error: ${openaiRes.status}` });
        }

        const openaiData = await openaiRes.json();
        let intelOutput;
        try {
            const textContent = openaiData.output
                ?.find((item) => item.type === 'message')
                ?.content?.find((c) => c.type === 'output_text');
            intelOutput = JSON.parse(textContent?.text || '{}');
        } catch (parseErr) {
            console.error('[url-intel] Parse error:', parseErr);
            return res.status(500).json({ ok: false, error: 'Failed to parse AI response' });
        }

        const referencedExactUrl = intelOutput.number_risk_assessment?.includes(url) || intelOutput.source_findings_summary?.includes(url) || intelOutput.ai_assessment?.includes(url);
        console.log(`[url-intel-report] Final report referenced exact URL: ${referencedExactUrl}`);
        const fallbackUsed = intelOutput.evidence_strength === 'none' || intelOutput.evidence_strength === 'weak_generic';
        console.log(`[url-intel-report] Fallback reporting logic used (weak evidence): ${fallbackUsed}`);

        /* 6. Save structured result */
        const existingRaw = triageRow.raw_response || {};
        const numberIntel = {
            url: url.trim(),
            lookup_status: lookupStatus,
            sources_checked: sourcesChecked,
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
            external_check_performed: !!externalUrlLookup,
            complaint_check_performed: false,
            web_search_performed: webCorroboration.search_performed,
            gemini_checked: geminiCorroboration.search_performed,
            checked_at: new Date().toISOString(),
        };
        const updatedRaw = { ...existingRaw, number_intel: numberIntel, number_intel_pending: false };

        const updateRes = await fetch(
            `${SUPABASE_URL}/rest/v1/ai_triage_results?id=eq.${encodeURIComponent(triage_id)}`,
            {
                method: 'PATCH',
                headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                },
                body: JSON.stringify({ raw_response: updatedRaw }),
            },
        );

        if (!updateRes.ok) {
            const text = await updateRes.text();
            return res.status(500).json({ ok: false, error: `Failed to save intel: ${updateRes.status}` });
        }

        return res.status(200).json({ ok: true, number_intel: numberIntel });
    } catch (err) {
        console.error('[url-intel] Unexpected error:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
