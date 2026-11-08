# Profile photo

Web, iOS, and Android use the same profile screen. The website publish includes this screen. An installed app keeps the previous profile photo screen until the next store build.

## Both outcomes

The camera button is on the profile photo for a signed-in PlateMaker and a signed-in PlateTaker. Signed out, the profile photo is the placeholder person.

Use this photo keeps the picture on the avatar as soon as the camera has a frame. If the frame is not ready, the button says to wait until the person is visible, then tap again. A gallery picture is still refused. The saved photo is the one taken in the app. That file is in the `profile-images` bucket, and the address is saved on the account. The next sign-in on a phone, a browser, or another phone shows that same photo. Signed out, the placeholder stays.

Another signed-in PlateMaker or PlateTaker can report that photo from a plate, a review, or Messages. The photo is then hidden on every device until an admin allows it. Remove leaves it hidden. The account that owns the photo still sees it on their own profile. `backend/sql/report_still_images.sql` was run in the SQL editor on 7 November 2026. The editor returned Success with no rows. Do not run it again. The hold stays local until the worker is published.
