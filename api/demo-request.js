// /api/demo-request.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
    const EMAIL_TO = process.env.DEMO_REQUEST_TO_EMAIL;

    if (!RESEND_API_KEY || !EMAIL_FROM || !EMAIL_TO) {
        console.error('[SLP] Missing Resend env vars:', { hasKey: !!RESEND_API_KEY, EMAIL_FROM, EMAIL_TO });
        return res.status(500).json({ ok: false, error: 'Server misconfiguration' });
    }

    try {
        const { full_name, work_email, phone_number, organisation_name, organisation_type, role, message } = req.body;

        if (!full_name || !work_email || !organisation_name || !phone_number) {
            return res.status(400).json({ ok: false, error: 'Missing required fields' });
        }

        // Build HTML email
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0B1E36; border-bottom: 2px solid #C9A84C; padding-bottom: 8px;">New Demo Request</h2>
              <p>A new demo request has been submitted securely via the public website.</p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                  <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #eee; width: 35%; color: #64748b; font-weight: bold;">Name</td>
                      <td style="padding: 10px; border-bottom: 1px solid #eee;">${full_name}</td>
                  </tr>
                  <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #eee; color: #64748b; font-weight: bold;">Organisation</td>
                      <td style="padding: 10px; border-bottom: 1px solid #eee;">${organisation_name}</td>
                  </tr>
                  <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #eee; color: #64748b; font-weight: bold;">Role</td>
                      <td style="padding: 10px; border-bottom: 1px solid #eee;">${role || 'Not provided'}</td>
                  </tr>
                  <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #eee; color: #64748b; font-weight: bold;">Work Email</td>
                      <td style="padding: 10px; border-bottom: 1px solid #eee;">${work_email}</td>
                  </tr>
                  <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #eee; color: #64748b; font-weight: bold;">Phone</td>
                      <td style="padding: 10px; border-bottom: 1px solid #eee;">${phone_number}</td>
                  </tr>
                  <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #eee; color: #64748b; font-weight: bold;">Org Type</td>
                      <td style="padding: 10px; border-bottom: 1px solid #eee;">${organisation_type || 'Not provided'}</td>
                  </tr>
                  <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #eee; color: #64748b; font-weight: bold;">Submitted At</td>
                      <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</td>
                  </tr>
              </table>
  
              ${message ? `
              <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-left: 4px solid #C9A84C; border-radius: 4px;">
                  <h4 style="margin: 0 0 10px 0; color: #0B1E36;">Optional Message:</h4>
                  <p style="margin: 0; white-space: pre-wrap; color: #334155;">${message}</p>
              </div>
              ` : ''}
              
              <p style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">
                  This is an automated notification from Second Look Protect.<br>
                  The record is safely stored in the demo_requests table.
              </p>
          </div>
          `;

        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: [EMAIL_TO],
                subject: 'New Demo Request - Second Look Protect',
                html: html,
            }),
        });

        if (!emailRes.ok) {
            const errorData = await emailRes.json();
            console.error('[SLP] Resend failure inside /api/demo-request:', errorData);
            // Return 200 so the client knows their DB save succeeded, even if email failed silently
            return res.status(200).json({
                ok: true,
                warning: 'Email dispatch failed but data was safely stored'
            });
        }

        return res.status(200).json({ ok: true, sent: true });

    } catch (err) {
        console.error('[SLP] Fatal error in /api/demo-request:', err);
        return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
}
