const TO_EMAIL = 'leo.tounsi9@gmail.com';
const FROM_EMAIL = 'WRZ Ops <formulaire@send.wrz-digital.com>';
// CRM (table diagnostic_leads) : clé publique « anon », l'insertion seule est autorisée par RLS
const SUPABASE_URL = 'https://cjlizuuaxucbpqykregv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGl6dXVheHVjYnBxeWtyZWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTQ1MDMsImV4cCI6MjA5NjA3MDUwM30.J0iCxAfrsmU3n5Yyjo1rffEhFTMcvTzxjrV3Ybtbisg';

// Enregistre la demande dans le CRM, source « contact ». N'empêche jamais l'envoi du mail.
async function saveToCrm({ name, email, company, message }) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/diagnostic_leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        source: 'contact',
        form_version: 0,
        prenom: String(name).slice(0, 200),
        commerce: company ? String(company).slice(0, 200) : null,
        email: String(email).slice(0, 200),
        open_text: String(message).slice(0, 5000),
        consent: true,
        canal: 'email'
      })
    });
    if (!r.ok) console.error('CRM insert error:', r.status, await r.text());
  } catch (err) {
    console.error('CRM insert failed:', err);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, company, message, website } = req.body || {};

  // honeypot: bots fill hidden fields, humans never see it
  if (website) return res.status(200).json({ success: true });

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Nom, email et message sont requis.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  await saveToCrm({ name, email, company, message });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email,
        subject: `Nouveau contact WRZ Ops — ${name}`,
        html: `
          <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
          <p><strong>Email :</strong> ${escapeHtml(email)}</p>
          ${company ? `<p><strong>Entreprise :</strong> ${escapeHtml(company)}</p>` : ''}
          <p><strong>Message :</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
          <p style="color:#888;font-size:12px">Enregistré dans le CRM (source : Contact site) — un brouillon de réponse y est préparé : https://wrz-digital.com/diagnostic/admin.html</p>
        `
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('Resend error:', errText);
      return res.status(502).json({ error: "Échec de l'envoi, réessayez plus tard." });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
}
