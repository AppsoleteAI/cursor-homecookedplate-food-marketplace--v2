# Text hold and moderator

Web, iOS, and Android share this app. The website publish on `main` includes this UI on https://homecookedplate.com and https://homecookedplate.pages.dev. `backend/sql/add_moderation_queue.sql` was run in the SQL editor on 7 November 2026. The editor returned Success with no rows. Do not run it again. The live orders table names the buyer `platetaker_id` and the cook `platemaker_id`. A new order message waits for a moderator. The Worker `plate-marketplace-api` was deployed 7 November 2026.

The phrase check runs after hidden characters are removed. It is a backstop for text a person will read. Words drawn in a picture can still push the vision model to answer SAFE.

## PlateMaker

Signed in. A cook message on an order is held. The buyer does not see it, and no push is sent, until an admin allows it. The cook sees “Waiting for a moderator.” A cook can report a buyer message. That message is hidden from the cook again until an admin allows it.

A plate note the buyer wrote is hidden from the cook until an admin allows it. A free-item offer line on that note still shows. Dietary options on a new plate, and a clip meal name, are refused when the text check blocks them.

A review comment on the cook’s plate is hidden until an admin allows it. The stars still show. The cook is told about the review when the comment is released. A stars-only review is told right away.

Signed out. The cook cannot send a message, post a plate, or open the moderator queue.

## PlateTaker

Signed in. A buyer message on an order is held the same way. The cook does not see it until an admin allows it. A buyer can report a cook message and a clip. A reported clip is hidden until an admin allows it. Reporting an order still tells the cook, and it also waits in the moderator queue.

Cooking temperature, allergy names, and the delivery address are refused when the text check blocks them, on create-order and on combined checkout. The buyer still sees a plate note they wrote, with a line that a moderator has not released it.

Signed out. The buyer cannot send a message or place an order.

A held review comment is not on the public review columns. The review list reads the words with the service role and shows them to the author, and to everyone else only after a moderator allows them. A plate note is read the same way for the buyer and the cook. On 11 November 2026 the SQL editor ran `backend/sql/hold_moderated_text.sql` and returned Success with no rows. Do not run it again. A signed-in PlateTaker or PlateMaker cannot read a held comment or a held note with the anon key, and cannot release their own comment. Signed out, that key cannot read a held comment. Web, iOS, and Android use the same source. `plate-marketplace-api` was deployed 11 November 2026. Version `c30c059c-70b8-4ad6-9f83-d87959649fcd`. A PlateMaker accept and a PlateTaker review list use this Worker.

## Admin

An `is_admin` account opens Moderator from the profile. Allow releases the message, note, or comment and then tells the other person. Remove keeps it hidden. Check saved text hides stored messages and notes that the text check blocks, and takes a blocked plate off the menu. It does not unsend a notification that already went out.
