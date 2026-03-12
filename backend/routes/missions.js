const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../lib/supabase');
const router = express.Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateAIMission(category, interests = [], lang = 'fr') {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: `You are the mission engine of SPARK, an international dating app.
Generate ONE original, deep question for two strangers to connect.
Category: ${category}. Interests: ${interests.join(', ') || 'general'}.
Language: ${lang === 'fr' ? 'French' : 'English'}.
Rules: 1-2 sentences max, intriguing, universal.
Reply ONLY with the question. No quotes. No preamble.`,
    messages: [{ role: 'user', content: 'Generate.' }]
  });
  return msg.content[0].text.trim();
}

// GET /api/missions
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .select(`
        *,
        sender:profiles!missions_sender_id_fkey(id, name, avatar, country),
        receiver:profiles!missions_receiver_id_fkey(id, name, avatar, country)
      `)
      .or(`sender_id.eq.${req.user.id},receiver_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/missions/generate
router.post('/generate', async (req, res, next) => {
  try {
    const { receiver_id, category = 'philosophy', lang = 'fr' } = req.body;
    if (!receiver_id) return res.status(400).json({ error: 'receiver_id requis' });

    const { data: profile } = await supabase
      .from('profiles').select('credits, interests').eq('id', req.user.id).single();
    if (!profile || profile.credits < 1) {
      return res.status(402).json({ error: 'Crédits insuffisants' });
    }

    const question = await generateAIMission(category, profile.interests || [], lang);

    await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', req.user.id);
    await supabase.from('credit_transactions').insert({ user_id: req.user.id, amount: -1, reason: 'mission_generate' });

    const { data: mission, error: mErr } = await supabase
      .from('missions')
      .insert({ sender_id: req.user.id, receiver_id, question, category, status: 'pending' })
      .select().single();
    if (mErr) throw mErr;

    res.status(201).json({ mission, credits_remaining: profile.credits - 1 });
  } catch (err) { next(err); }
});

// POST /api/missions/coach — conseil IA
router.post('/coach', async (req, res, next) => {
  try {
    const { message, lang = 'fr' } = req.body;
    if (!message) return res.json({ tip: lang === 'fr' ? 'Sois authentique !' : 'Be yourself!' });
    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: `Connection coach. ONE tip, max 12 words. Language: ${lang === 'fr' ? 'French' : 'English'}. Positive and concrete. Reply ONLY with the tip.`,
      messages: [{ role: 'user', content: `Last message: "${message}"` }]
    });
    res.json({ tip: result.content[0].text.trim() });
  } catch {
    res.json({ tip: 'Continue d\'être toi-même !' });
  }
});

// POST /api/missions/:id/accept
router.post('/:id/accept', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .update({ status: 'active' })
      .eq('id', req.params.id)
      .eq('receiver_id', req.user.id)
      .eq('status', 'pending')
      .select().single();
    if (error || !data) return res.status(404).json({ error: 'Mission introuvable' });
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/missions/:id/complete
router.post('/:id/complete', async (req, res, next) => {
  try {
    const { data: mission } = await supabase
      .from('missions').select('*').eq('id', req.params.id).single();
    if (!mission) return res.status(404).json({ error: 'Mission introuvable' });

    await supabase.from('missions').update({ status: 'completed' }).eq('id', req.params.id);

    const score = 70 + Math.floor(Math.random() * 25);
    const [u1, u2] = [mission.sender_id, mission.receiver_id].sort();
    await supabase.from('matches').upsert(
      { user1_id: u1, user2_id: u2, mission_id: mission.id, compatibility_score: score },
      { onConflict: 'user1_id,user2_id' }
    );
    res.json({ message: 'Match créé !', compatibility_score: score });
  } catch (err) { next(err); }
});

// GET /api/missions/:id/messages
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles(name, avatar)')
      .eq('mission_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/missions/:id/messages
router.post('/:id/messages', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message vide' });

    const banned = ['http://', 'https://', 'whatsapp', 'telegram', 'instagram', 'snapchat'];
    if (banned.some(w => content.toLowerCase().includes(w))) {
      return res.status(400).json({ error: 'Les contacts externes ne sont pas autorisés ici.' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({ mission_id: req.params.id, sender_id: req.user.id, content: content.trim() })
      .select('*, sender:profiles(name, avatar)')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

module.exports = router;
