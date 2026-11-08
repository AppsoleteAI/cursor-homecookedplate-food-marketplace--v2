# Chargeback annual fee

Future only. This fee is not in the app. Web, iOS, and Android would use the same source when it is built. Nothing here was deployed.

Today, 3 chargebacks in a rolling 30 days remove a PlateMaker’s selling. An admin restores selling. If selling stays removed, the remaining cook share is transferred 30 days later, minus pending chargebacks and fees still owed. The $15 lost-dispute fee is separate. It is withheld from a held payout, or taken back from a Transfer that can cover it.

The future rule is an upfront annual fee of $1,000. A PlateMaker whose selling was removed for chargebacks can pay that $1,000 once, for one year, and selling can open again for that year. The $1,000 is not a replacement for the $15 lost-dispute fee. Money for this fee belongs in `backend/lib/fees.ts` when it is built. It is not there now.

## PlateMaker

Signed in. Selling removed for chargebacks stays removed. There is no $1,000 button, no charge, and no automatic restore. The cook can still message an admin from Payouts and responsibility. The 30-day final payout still applies while selling stays removed.

Signed out. No fee, no restore, and no payout.

## PlateTaker

Signed in. This $1,000 fee is not charged to a buyer. A PlateTaker ban is still the lost-dispute count: 4 in a rolling 12 months, or the 3rd when 2 fall inside 60 days. Paying $1,000 does not clear that ban, because this note is only the cook’s chargeback removal.

Signed out. No order and no dispute count.
