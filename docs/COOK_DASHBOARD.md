# Cook dashboard load

Web, iOS, and Android use the same dashboard screen. A push to main publishes the screen on the website. The lighter earnings query also needs the API worker published before the live site uses it. The iOS and Android store builds stay on the previous copy until a new build.

## PlateMaker

The dashboard paints the header, the availability switch, Get GPS, and the plates without waiting for the earnings scan. Today and this week use the orders already on the phone until the server take-home arrives. Opening the tab does not download every order again. Refresh on Active Orders still does. Earnings stay for a minute before another scan. Stripe payout status stays for five minutes. The worker copy of the earnings scan totals the completed orders instead of reading every row, and the plate list can ask for names only. Those two stay unused until that worker is published. The screen still calls the current plate list.

## PlateTaker

A buyer who opens this route is sent home. The buyer dashboard does not run the cook earnings scan, the cook plate list, or the Stripe payout check. Buyer orders still load with the account, the same way they did before.
