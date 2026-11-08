# Food photos

Web, iOS, and Android use `FoodImage`. A plate photo, a cart photo, an order photo, and a listed food photo all use that crop. A profile photo, a license, and a permit stay as they are.

The frame covers the photo. A wide photo stays centered from side to side. A tall photo shifts so the dish, which usually sits a little below the middle, lands in the middle of the frame. The home banner is that short frame, so the cake sits in the center instead of along the bottom edge.

## Both outcomes

Signed out, Home is not on screen.

The photo file is in the `meal-media` bucket. The address is saved on the plate. Signed in, a PlateMaker and a PlateTaker see that photo on every device. A video on the same plate plays on the plate page. A reported video stays off the plate and off Clips until an admin allows it. On a plate that is not their own, either role can press Report this photo. That photo is hidden on every device until an admin allows it. Remove leaves it hidden. Signed in, a PlateMaker and a PlateTaker see the same crop on Home, Search, and a plate. Clips stays a video. A PlateTaker also sees it on Cart and Orders. A PlateMaker also sees it on the kitchen order row, on a plate being created, and on the photo attached to a listed dish, farm good, truck item, prep item, or catering package. A photo of a kitchen, a truck, a restaurant, or a stand stays centered on the whole photo.

The photo report and the reported-video hold stay local until the worker is published. `backend/sql/report_still_images.sql` was run in the SQL editor on 7 November 2026. The editor returned Success with no rows. Do not run it again. A push to main publishes the website. The iOS and Android store builds stay on the previous copy until a new build.
