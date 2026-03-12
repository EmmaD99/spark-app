const express = require('express');
const supabase = require('../lib/supabase');
const router = express.Router();

// GET /api/matches
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        user1:profiles!matches_user1_id_fkey(id, name, avatar, country),
        user2:profiles!matches_user2_id_fkey(id, name, avatar, country),
        mission:missions(question)
      `)
      .or(`user1_id.eq.${req.user.id},user2_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

module.exports = router;
