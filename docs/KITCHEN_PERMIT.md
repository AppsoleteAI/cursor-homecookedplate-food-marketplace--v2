# Home-kitchen agreement for cooked plates

A cooked plate is a meal from a home kitchen. The food rules depend on the city, county, and state. Some places require no license. Some require a limited license. Others require a stricter permit. HomeCookedPlate does not decide which rule applies and does not enforce that matrix.

The plate stays off the public menu until the PlateMaker saves the home-kitchen agreement. The agreement is six acknowledgements: the in-app food handling page was read, the in-app state and local food-requirement page was read, the cook will follow the rules where the food is cooked, the cook takes full responsibility and all liability for food served to PlateTakers, the cook waives any claim of responsibility or liability against HomeCookedPlate, Appsolete, PUSL, LLC, and any associated entities or individuals, and this acknowledgement: if the city, county, or state governing body requires a commissary kitchen, the cook (platemaker) will ensure access to an authorized kitchen and will meet every requirement that comes with it. HomeCookedPlate does not provide a commissary kitchen and does not review that access.

An older record that stored a kitchen name, permit number, or fee does not count. A saved agreement that is missing the commissary acknowledgement does not count either. The cook saves the agreement again.

The record is `profiles.kitchen_permit`. Only the service role can write it. The column was added 1 November 2026 from `backend/sql/add_store_subscription_and_kitchen_permit.sql`. The SQL editor returned Success with no rows. Do not run that file again. A cooked plate stays off the menu until this account saves the six acknowledgements.

Publish stays closed until that save. Save details, which is the step that lists the plate, stays closed until the same save.

Farm, food truck, sit-down, catering, and meal prep use the same six acknowledgements. Each section saves its own copy. A listing in that section stays off the menu until that copy is saved, including the commissary acknowledgement. Sample plates in `lib/sample-meals.ts` are placeholders. A published plate with no saved agreement does not count toward retiring a sample, so the placeholders stay on the menu.

A catering package is priced per person. The cook’s minimum is at least 6. A PlateTaker cannot place that package for fewer people than the minimum on the package. Sample catering packages keep the higher minimums already printed on them.

Web, iOS, and Android use the same source. The website publish on `main` includes this UI on https://homecookedplate.com and https://homecookedplate.pages.dev. The column is already on the live table. Build 9 includes this screen. The public reviews are still build 8, which does not. A signed-in PlateMaker on build 8 saves the agreement on the website. A signed-in PlateTaker on build 8 orders after that save. Signed out, both roles use the public site.

## PlateMaker

| | Signed in | Signed out |
| --- | --- | --- |
| Home-kitchen agreement | Dashboard, Kitchen rules, and the plate screen open `/kitchen-permit`. Save writes the acknowledgements. | The screen is not available. Sign in as a PlateMaker first. |
| New cooked plate | Publish and Save details stay closed until the agreement is saved, including the commissary acknowledgement. The server also refuses create and the listing save. | A plate cannot be published. |
| Catering package | A new package needs a minimum of at least 6. The cook can set a higher minimum. | A package cannot be published. |
| Own plates | My plates still lists the cook’s own rows, including a row saved before the agreement. Opening one’s own plate still works. The public menu omits it until the agreement is saved. | Not available. |
| Buyer menu | The cook’s cooked plates stay off the public menu until the agreement is saved. | Same. |

## PlateTaker

| | Signed in | Signed out |
| --- | --- | --- |
| Menu and search | A cooked plate with no saved agreement is omitted. Sample placeholders stay. | The same public list omits it. Sample placeholders stay. |
| Plate page | Opening someone else’s plate without the agreement says that plate is not on the menu. | Same. |
| Order | Checkout refuses that plate. One charge, farm, truck, sit-down, catering, and meal prep still open for their own goods. A catering package cannot be ordered below the minimum on that package, and a cook’s package cannot go below 6. | Sign-in is still required before an order. The plate is already off the menu. |
| Agreement form | A PlateTaker who opens the screen is sent home and cannot save it. | Same. |
