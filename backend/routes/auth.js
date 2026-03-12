const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const router = express.Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(30),
  age: z.number().min(18).max(80),
  country: z.string().optional(),
  avatar: z.string().default('🔥'),
  bio: z.string().max(200).optional(),
  intent: z.string().optional(),
  interests: z.array(z.string()).max(5).default([])
});

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      name: data.name,
      age: data.age,
      country: data.country || null,
      avatar: data.avatar,
      bio: data.bio || null,
      intent: data.intent || null,
      interests: data.interests,
      credits: 5
    });
    if (profileError) return res.status(400).json({ error: profileError.message });

    res.status(201).json({ message: 'Compte créé avec succès !' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', data.user.id).single();

    // Mise à jour last_active
    await supabase.from('profiles').update({ last_active: new Date() }).eq('id', data.user.id);

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: profile
    });
  } catch (err) { next(err); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token requis' });
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ error: 'Session expirée, reconnecte-toi' });
    res.json({ token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (err) { next(err); }
});

module.exports = router;
