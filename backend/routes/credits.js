const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../lib/supabase');
const router = express.Router();

const PACKS = {
  starter:  { credits: 10,  amount: 199,  currency: 'eur', name: 'Pack Starter' },
  pro:      { credits: 35,  amount: 499,  currency: 'eur', name: 'Pack Pro' },
  premium:  { credits: 100, amount: 999,  currency: 'eur', name: 'Pack Premium' },
  unlimited:{ credits: 9999,amount: 1499, currency: 'eur', name: 'Abonnement Illimité' }
};

// GET /api/credits — solde
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles').select('credits').eq('id', req.user.id).single();
    if (error) throw error;
    res.json({ credits: data.credits });
  } catch (err) { next(err); }
});

// POST /api/credits/checkout — crée une session Stripe
router.post('/checkout', async (req, res, next) => {
  try {
    const { pack } = req.body;
    const p = PACKS[pack];
    if (!p) return res.status(400).json({ error: 'Pack invalide' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: p.currency,
          product_data: { name: `SPARK — ${p.name}` },
          unit_amount: p.amount
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}?credits=ok`,
      cancel_url: `${process.env.FRONTEND_URL}?credits=cancel`,
      metadata: { user_id: req.user.id, pack, credits: p.credits }
    });

    res.json({ url: session.url });
  } catch (err) { next(err); }
});

module.exports = router;
