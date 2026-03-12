const express = require('express');
const supabase = require('../lib/supabase');
const router = express.Router();

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [
      { count: total_users },
      { count: total_missions },
      { count: total_matches },
      { data: revenueData },
      { count: new_today }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('missions').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('credit_transactions').select('amount').eq('reason', 'purchase')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    ]);

    const { count: active_users } = await supabase.from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_active', new Date(Date.now() - 30 * 86400000).toISOString());

    const revenue_month = (revenueData || []).reduce((s, t) => s + (t.amount || 0), 0);

    res.json({ total_users, total_missions, total_matches, active_users, revenue_month, new_today });
  } catch (err) { next(err); }
});

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, age, country, avatar, credits, is_premium, is_admin, created_at, last_active')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Récupérer les emails depuis Supabase Auth
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = {};
    (authUsers?.users || []).forEach(u => { emailMap[u.id] = u.email; });

    const result = profiles.map(p => ({ ...p, email: emailMap[p.id] || '—' }));
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res, next) => {
  try {
    await supabase.from('profiles').delete().eq('id', req.params.id);
    await supabase.auth.admin.deleteUser(req.params.id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) { next(err); }
});

// GET /api/admin/transactions
router.get('/transactions', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*, user:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data.map(t => ({ ...t, user_name: t.user?.name || '—' })));
  } catch (err) { next(err); }
});

// PATCH /api/admin/users/:id/make-admin
router.patch('/users/:id/make-admin', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles').update({ is_admin: true }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

module.exports = router;
