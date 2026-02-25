import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    
    if (!apiKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is not set in environment variables. ' +
        'Please add STRIPE_SECRET_KEY to your .env file.'
      );
    }
    
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2026-01-28.clover',
    });
  }
  
  return stripeInstance;
};
