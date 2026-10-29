# Text hold and moderator

Web, iOS, and Android share this app. The website publish on `main` includes this UI on https://homecookedplate.com and https://homecookedplate.pages.dev. Held messages, notes, and the Moderator screen need the Worker update and `backend/sql/add_moderation_queue.sql` in the Supabase SQL editor. The live orders table names the buyer `platetaker_id` and the cook `platemaker_id`. Until that SQL is applied, a new order message is not sent.

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

## Admin

An `is_admin` account opens Moderator from the profile. Allow releases the message, note, or comment and then tells the other person. Remove keeps it hidden. Check saved text hides stored messages and notes that the text check blocks, and takes a blocked plate off the menu. It does not unsend a notification that already went out.
