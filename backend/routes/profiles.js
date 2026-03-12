const express = require('express');
const supabase = require('../lib/supabase');
const router = express.Router();

// GET /api/profiles/me
router.get('/me', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', req.user.id).single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// PATCH /api/profiles/me
router.patch('/me', async (req, res, next) => {
  try {
    const allowed = ['name', 'bio', 'interests', 'intent', 'avatar', 'city', 'push_token'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    const { data, error } = await supabase
      .from('profiles').update(updates).eq('id', req.user.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/profiles/discover
router.get('/discover', async (req, res, next) => {
  try {
    const { page = 0, limit = 12 } = req.query;
    const from = Number(page) * Number(limit);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, age, country, city, avatar, interests, intent')
      .neq('id', req.user.id)
      .order('last_active', { ascending: false })
      .range(from, from + Number(limit) - 1);
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

module.exports = router;
