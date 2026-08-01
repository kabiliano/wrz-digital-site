const TO_EMAIL = 'kabiliano78@hotmail.fr';
const FROM_EMAIL = 'WRZ Ops <formulaire@send.wrz-digital.com>';

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
