const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../lib/supabase');
const router = express.Router();

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { user_id, credits } = session.metadata;
    const creditsToAdd = parseInt(credits, 10);

    const { data: profile } = await supabase
      .from('profiles').select('credits').eq('id', user_id).single();

    if (profile) {
      await supabase.from('profiles')
        .update({ credits: profile.credits + creditsToAdd }).eq('id', user_id);
      await supabase.from('credit_transactions').insert({
        user_id,
        amount: creditsToAdd,
        reason: 'purchase',
        stripe_payment_id: session.payment_intent
      });
    }
  }

  res.json({ received: true });
});

module.exports = router;
