# Fee and payments plan (Caresitters)

Fee: 10 percent service fee, paid by the family on top. The carer keeps 100 percent of their rate. No cut from carers.
Example: 4 hour trial at 42 dollars an hour is 168 dollars. Fee 16.80. Family pays 184.80. Carer gets 168.

How they pay: inside the app, by card, Apple Pay or Google Pay, through Stripe Connect (Express accounts).
- Carer: taps "Get paid", Stripe asks for ID and bank in a few taps. Stripe does the ID check.
- Family: pays when booking. Money is held, then sent to the carer when the shift or trial is done (separate charges and transfers).

Do I need your Stripe? Yes, one time, and never in chat. You make a Stripe account for Caresitters, turn on Connect, then add the secret key as a GitHub secret (STRIPE_SECRET_KEY) and the publishable key in the app. Do not paste keys in chat.

Not confirmed, check before launch:
- Stripe Australia fee rates in your dashboard.
- Whether Australian rules need a licence to hold money (Stripe holds it, which is the usual safe route).
- Apple rule 3.1.3(e): real world person to person services may use non Apple payment. Confirm on https://developer.apple.com/app-store/review/guidelines/ .
