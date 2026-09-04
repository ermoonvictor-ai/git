# Client apps for your ~50 people

The web client (Element Web) is deployed at `https://<your-domain>` and
needs nothing installed. For phones/desktops, any standard Matrix client
works against this server — people aren't limited to Element:

- **iOS / Android**: Element (App Store / Play Store), or FluffyChat for a
  simpler UI.
- **Desktop**: Element Desktop (Windows/macOS/Linux), or the web client.

On first login in any client:
1. Choose "I already have an account" / custom homeserver.
2. Enter homeserver URL: `https://<your-domain>`.
3. Log in with the username/password an admin created via
   `scripts/create-user.sh`.

## Verifying E2E encryption

Matrix's E2EE (Olm/Megolm — the same double-ratchet family Signal uses) is
on by default for any room marked private/invite-only, which is how every
room here should be created. After a couple of people are on the server:

1. Have two people open a DM or private room.
2. In the room's member list, check the other person's device — it should
   show as "unverified" until you cross-sign.
3. Cross-sign (comparing an emoji sequence or QR code in person or over a
   trusted channel) so the client stops warning about unverified devices.
   This is the same manual trust step Signal's "safety numbers" solve —
   it's optional but closes the "malicious server swaps someone's key"
   gap.

## Voice/video calls

1:1 and small group calls work out of the box once coturn is running (see
`.env`'s `TURN_SHARED_SECRET` / `EXTERNAL_IP`). No separate app needed —
it's built into Element and most other Matrix clients.
