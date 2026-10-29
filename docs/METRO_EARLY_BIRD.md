# The metros and Early Bird slots

These circles are the Early Bird list. A PlateMaker inside one chooses Early Bird or a paid plan. A PlateMaker outside every circle is Remote/Other. That cook can start 120 days at no charge, then monthly is $4.99 and yearly is $39.99. That period is not Early Bird. A plate is offered only within 20 miles of the cook's saved pin, in a named metro and in Remote/Other. PlateTaker Premium stays optional.

The circle and the slot count live in code:

- `backend/lib/metro-radius.ts` holds the downtowns and the radius.
- `backend/lib/early-bird-cap.ts` holds the July 1, 2024 populations and the slot formula.
- `backend/lib/early-bird.ts` offers Early Bird when the PlateMaker's signup rank is inside that metro's slot count.

## Radius

Every metro uses the same circle: **80,000 meters, about 50 miles, around downtown.** The nearest downtown inside that distance wins when circles overlap, including Washington and Baltimore, and Boston and Providence. A point outside every circle stays unmatched.

Get GPS checks a saved PostGIS shape first. When that lookup misses, the app uses this 50-mile circle and saves the metro name on the account.

## Early Bird slots

One PlateMaker per 10,000 people. The app takes the whole number from that division, then keeps it between **200 and 1,000**.

The population is the U.S. Census Bureau Vintage 2024 metropolitan statistical area estimate for July 1, 2024, from `cbsa-est2024-alldata.csv`. The 50-mile circle and the Census metro boundary are different shapes. The slot count uses the Census figure.

Early Bird is PlateMaker only. The length is `metro_geofences.trial_days`, and the app uses 90 days when that value is missing. Choosing it does not open Stripe and does not charge a card. The start is `profiles.trial_started_at` when that column exists. The end is `profiles.trial_ends_at`. When that date passes, Premium ends and the kitchen closes until the PlateMaker pays.

A PlateMaker already on a paid plan, or one who already has an end date, does not get a second Early Bird. Signup does not start the 90 days. The PlateMaker starts it from Membership.

Rank is the count of PlateMakers in that metro whose `created_at` is at or before this account. The PlateMaker at the slot count can still claim Early Bird. The next one chooses monthly or yearly.

PlateMaker prices are $4.99 a month and $39.99 a year. PlateTaker Premium is $7.99 a month and $75.99 a year. Prices live in `SUBSCRIPTION_PRICES` in `backend/lib/fees.ts`.

The admin metro screen edits `metro_area_counts.max_cap`. That column is the member-count alert. Its stored default is 100. Early Bird slots are the table below.

A few Census names differ from the name saved in the app. The population on each row is the matching 2024 metropolitan area:

- Houston-The Woodlands-Sugar Land is Houston-Pasadena-The Woodlands in the 2024 file.
- Atlanta-Sandy Springs-Alpharetta is Atlanta-Sandy Springs-Roswell.
- Miami-Fort Lauderdale-Pompano Beach is Miami-Fort Lauderdale-West Palm Beach.
- Austin-Round Rock-Georgetown is Austin-Round Rock-San Marcos.
- Denver-Aurora-Lakewood is Denver-Aurora-Centennial.
- Indianapolis-Carmel-Anderson is Indianapolis-Carmel-Greenwood.
- Las Vegas-Henderson-Paradise is Las Vegas-Henderson-North Las Vegas.
- San Francisco-Oakland-Berkeley is San Francisco-Oakland-Fremont.
- Virginia Beach-Norfolk-Newport News is Virginia Beach-Chesapeake-Norfolk.
- Cleveland-Elyria is Cleveland, OH.
- Birmingham-Hoover is Birmingham, AL.
- Salt Lake City is Salt Lake City-Murray, UT.
- Columbus is the Ohio metro. Rochester is the New York metro. Jacksonville is the Florida metro. Portland is Oregon.

## The metros

| Metro | Downtown | Population | Early Bird slots |
| --- | --- | ---: | ---: |
| New York-Newark-Jersey City | 40.7128, -74.0060 | 19,940,274 | 1,000 |
| Los Angeles-Long Beach-Anaheim | 34.0522, -118.2437 | 12,927,614 | 1,000 |
| Chicago-Naperville-Elgin | 41.8781, -87.6298 | 9,408,576 | 940 |
| Dallas-Fort Worth-Arlington | 32.7767, -96.7970 | 8,344,032 | 834 |
| Houston-The Woodlands-Sugar Land | 29.7604, -95.3698 | 7,796,182 | 779 |
| Washington-Arlington-Alexandria | 38.9072, -77.0369 | 6,436,489 | 643 |
| Philadelphia-Camden-Wilmington | 39.9526, -75.1652 | 6,330,422 | 633 |
| Miami-Fort Lauderdale-Pompano Beach | 25.7617, -80.1918 | 6,457,988 | 645 |
| Atlanta-Sandy Springs-Alpharetta | 33.7490, -84.3880 | 6,411,149 | 641 |
| Boston-Cambridge-Newton | 42.3601, -71.0589 | 5,025,517 | 502 |
| Phoenix-Mesa-Chandler | 33.4484, -112.0740 | 5,186,958 | 518 |
| San Francisco-Oakland-Berkeley | 37.7749, -122.4194 | 4,648,486 | 464 |
| Riverside-San Bernardino-Ontario | 33.9806, -117.3755 | 4,744,214 | 474 |
| Detroit-Warren-Dearborn | 42.3314, -83.0458 | 4,400,578 | 440 |
| Seattle-Tacoma-Bellevue | 47.6062, -122.3321 | 4,145,494 | 414 |
| Minneapolis-St. Paul-Bloomington | 44.9778, -93.2650 | 3,757,952 | 375 |
| San Diego-Chula Vista-Carlsbad | 32.7157, -117.1611 | 3,298,799 | 329 |
| Tampa-St. Petersburg-Clearwater | 27.9506, -82.4572 | 3,424,560 | 342 |
| Denver-Aurora-Lakewood | 39.7392, -104.9903 | 3,052,498 | 305 |
| Baltimore-Columbia-Towson | 39.2904, -76.6122 | 2,859,024 | 285 |
| St. Louis | 38.6270, -90.1994 | 2,811,927 | 281 |
| Orlando-Kissimmee-Sanford | 28.5383, -81.3792 | 2,940,513 | 294 |
| Charlotte-Concord-Gastonia | 35.2271, -80.8431 | 2,883,370 | 288 |
| San Antonio-New Braunfels | 29.4241, -98.4936 | 2,763,006 | 276 |
| Portland-Vancouver-Hillsboro | 45.5152, -122.6784 | 2,537,904 | 253 |
| Sacramento-Roseville-Folsom | 38.5816, -121.4944 | 2,463,127 | 246 |
| Pittsburgh | 40.440624, -79.995888 | 2,429,917 | 242 |
| Austin-Round Rock-Georgetown | 30.2672, -97.7431 | 2,550,637 | 255 |
| Las Vegas-Henderson-Paradise | 36.1699, -115.1398 | 2,398,871 | 239 |
| Cincinnati | 39.1031, -84.5120 | 2,302,815 | 230 |
| Kansas City | 39.0997, -94.5786 | 2,253,579 | 225 |
| Columbus | 39.9612, -82.9988 | 2,225,377 | 222 |
| Indianapolis-Carmel-Anderson | 39.7684, -86.1581 | 2,174,833 | 217 |
| Cleveland-Elyria | 41.4993, -81.6944 | 2,171,877 | 217 |
| Nashville-Davidson-Murfreesboro-Franklin | 36.1627, -86.7816 | 2,150,553 | 215 |
| Virginia Beach-Norfolk-Newport News | 36.8529, -75.9780 | 1,794,278 | 200 |
| Providence-Warwick | 41.8240, -71.4128 | 1,700,901 | 200 |
| Jacksonville | 30.3322, -81.6557 | 1,760,548 | 200 |
| Milwaukee-Waukesha | 43.0389, -87.9065 | 1,574,452 | 200 |
| Oklahoma City | 35.4676, -97.5164 | 1,497,821 | 200 |
| Raleigh-Cary | 35.7796, -78.6382 | 1,562,009 | 200 |
| Memphis | 35.1495, -90.0490 | 1,339,345 | 200 |
| Richmond | 37.5407, -77.4360 | 1,370,165 | 200 |
| Louisville/Jefferson County | 38.2527, -85.7585 | 1,394,234 | 200 |
| New Orleans-Metairie | 29.9511, -90.0715 | 966,230 | 200 |
| Salt Lake City | 40.7608, -111.8910 | 1,300,762 | 200 |
| Hartford-West Hartford-East Hartford | 41.7658, -72.6734 | 1,169,048 | 200 |
| Buffalo-Cheektowaga | 42.8864, -78.8784 | 1,160,172 | 200 |
| Birmingham-Hoover | 33.5207, -86.8025 | 1,192,583 | 200 |
| Rochester | 43.1566, -77.6088 | 1,057,218 | 200 |
| Anchorage | 61.2181, -149.9003 | 407,213 | 200 |
| Honolulu | 21.3069, -157.8583 | 998,747 | 200 |
| San Juan | 18.4655, -66.1057 | 2,035,484 | 203 |
| Mayagüez | 18.2013, -67.1396 | 207,205 | 200 |
| Charlotte Amalie | 18.3419, -64.9307 | 87,146 | 200 |

Anchorage, Urban Honolulu, San Juan-Bayamón-Caguas, and Mayagüez use the Census Vintage 2024 metropolitan estimate for July 1, 2024. Charlotte Amalie uses the 2020 Census count for the U.S. Virgin Islands, 87,146, because the Vintage 2024 metro file does not include that territory. The circle is still 50 miles around Charlotte Amalie, which reaches St. Thomas, St. John, and St. Croix. San Juan's slot count is 203. The other four stay at the 200 floor.

Ponce is inside the San Juan circle. A point outside every circle, including another country, stays Remote/Other.
