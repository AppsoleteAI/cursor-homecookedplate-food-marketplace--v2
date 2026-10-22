export type CottageMapBand = 'hazardous' | 'non_hazardous' | 'baked_only' | 'none';

export type CottageDirectoryRow = {
  code: string;
  band: CottageMapBand;
  note?: string;
  expanded?: string;
  cap?: string;
  foodFreedom?: boolean;
};

export const COTTAGE_DIRECTORY_NOTICE =
  'HomeCookedPlate is not affiliated with, partnered with, or endorsed by any directory or publisher linked here. This grouping follows the Farm-to-Consumer Legal Defense Fund map legend as of July 30, 2026. It is not a permit, a statute, or a county rule. Confirm the current food list, sales cap, and fee with your own agency before you sell.';

export const COTTAGE_MAP_URL = 'https://www.farmtoconsumer.org/cottage-foods-map/';

export const VEGETABLE_LEATHER_TITLE = 'Vegetable leathers';
export const VEGETABLE_LEATHER_ALSO = 'Fruit / Veggie Strips';
export const VEGETABLE_LEATHER_PARAGRAPHS = [
  'Vegetable leathers, also called Fruit / Veggie Strips, are a savory version of fruit leather. Vegetables are pureed, dried, and rolled, instead of fruit.',
  'They are dried until almost all of the moisture is gone, so they are shelf-stable, slow to mold, and easy to pack. Publisher summaries say Delaware allows them on a cottage list because that low moisture limits bacterial growth without refrigeration. Confirm your own state before you sell them.',
  'The base is cooked and blended into a thick puree. Squash, pumpkin, tomato, sweet potato, and beet are the vegetables named for this snack. The puree is spread thin and dried at a low temperature until it is pliable, leather-like, and no longer sticky.',
  'They are sold as a chewy snack. They can also be soaked in hot water and used as a vegetable sheet, a soup thickener, or a wrap.',
];

export function isVegetableLeatherSearch(query: string): boolean {
  return /\b(vegetable leathers?|fruit leathers?|veggie strips|fruit strips)\b/i.test(query.trim());
}

export const COTTAGE_RESOURCES: { name: string; url: string; detail: string }[] = [
  {
    name: 'Farm-to-Consumer cottage foods map',
    url: COTTAGE_MAP_URL,
    detail: 'The state map and chart this directory follows. The page says specific requirements vary by state.',
  },
  {
    name: 'Cottage Food Laws',
    url: 'https://cottagefoodlaws.com/',
    detail: 'A publisher map of cottage food laws. HomeCookedPlate is not affiliated with this site.',
  },
  {
    name: 'Cottage Food License, states',
    url: 'https://www.cottagefoodlicense.com/states',
    detail: 'A publisher directory of state program pages.',
  },
  {
    name: 'Foods you can sell under cottage food laws',
    url: 'https://findhomegrown.com/blog/what-foods-can-you-sell-under-cottage-food-laws',
    detail: 'A publisher summary of foods that go beyond the shelf-stable list in some states.',
  },
  {
    name: 'Cottage food labeling laws',
    url: 'https://info.mycustombakes.com/blog-cottage-food-labeling-laws-all-50-states/',
    detail: 'A publisher summary of labeling rules. It is not this app’s label.',
  },
  {
    name: 'California approved cottage foods',
    url: 'https://www.cdph.ca.gov/Programs/CEH/DFDCS/CDPH%20Document%20Library/FDB/FoodSafetyProgram/CottageFood/ApprovedCottageFoodsList.pdf',
    detail: 'The California Department of Public Health list. Use it for California only.',
  },
  {
    name: 'UC cottage foods, approved foods',
    url: 'https://ucanr.edu/site/cottage-foods/approved-cottage-foods',
    detail: 'A University of California page on the state approved-food list.',
  },
  {
    name: 'Food freedom states',
    url: 'https://findhomegrown.com/blog/food-freedom-states-sell-from-home',
    detail: 'A publisher summary of states that describe sales beyond a shelf-stable cottage list.',
  },
  {
    name: 'Cottage food law guide, 2026',
    url: 'https://butterbase.app/blog/cottage-food-law-guide-2026/',
    detail: 'A publisher summary of 2026 cottage and food-freedom rules. It is not this app’s rule.',
  },
  {
    name: 'Michigan cottage foods',
    url: 'https://www.michigan.gov/mdard/food-dairy/cottage-food/what-can-i-make',
    detail: 'The Michigan department page on what a cottage kitchen can make.',
  },
  {
    name: 'Florida cottage foods',
    url: 'https://www.fdacs.gov/Business-Services/Food-Establishments/Cottage-Foods',
    detail: 'The Florida department page for cottage food operations.',
  },
  {
    name: 'Florida cottage food operations',
    url: 'https://sfyl.ifas.ufl.edu/media/sfylifasufledu/st-johns/fcs/pdf/CottageFoodOperations.pdf',
    detail: 'A University of Florida extension summary. Use it for Florida only.',
  },
  {
    name: 'Illinois cottage food',
    url: 'https://illinois-doit-prod-idph.amsadobe.com/topics-services/food-safety/cottage-food.html',
    detail: 'The Illinois public-health page for cottage food.',
  },
  {
    name: 'Illinois extension cottage list',
    url: 'https://extension.illinois.edu/media/9376/download?inline',
    detail: 'A University of Illinois extension file on cottage foods.',
  },
  {
    name: 'Georgia cottage food',
    url: 'https://agr.georgia.gov/cottage-food',
    detail: 'The Georgia Department of Agriculture cottage food page.',
  },
  {
    name: 'New York home processing',
    url: 'https://agriculture.ny.gov/food-safety/home-processing',
    detail: 'The New York agriculture page for home processing.',
  },
];

const FREEDOM_CAP = 'No annual earnings cap is named for this food-freedom path in the publisher summaries.';
const FREEDOM_ITEMS = 'Publisher summaries describe face-to-face sales of fully prepared hot home meals, dairy products, cheesecakes, and cooked meats under a food-freedom or expanded cottage exemption.';

const ROWS: CottageDirectoryRow[] = [
  { code: 'AL', band: 'non_hazardous', expanded: 'Standard baked goods, jams, and candies. A local zoning check is described before a home kitchen is approved.', cap: 'No annual sales cap is described.' },
  { code: 'AK', band: 'hazardous', expanded: 'Wild-harvested berry jams and jellies. Non-perishable baked items at local bazaars and public markets are described as allowed without a permit when a visible advisory sign is posted.' },
  { code: 'AZ', band: 'hazardous', note: 'The map paints Arizona green. The chart on that page lists non-potentially hazardous foods, including fruit jams, dry mixes, honey, dry pasta, and roasted nuts.', expanded: 'Publisher summaries also name candied and chocolate-dipped fruit.' },
  { code: 'AR', band: 'non_hazardous', expanded: 'Doughnuts are named on the cottage list. Direct sales to retail grocery stores are described, which many states keep off a cottage path.' },
  { code: 'CA', band: 'non_hazardous', expanded: 'Publisher summaries say California also names high-proof food extracts, churros, empanadas, conchas, candied apples, and nut butters made from roasted or pasteurized nuts. The state list is the source, not this note.' },
  { code: 'CO', band: 'non_hazardous', note: 'The map paints Colorado yellow. The chart on that page also describes a 2026 path for some foods that need temperature control.', expanded: 'Publisher summaries name USDA-inspected meat products, including home-prepared tamales and burritos. Confirm the current list before you sell those foods.' },
  { code: 'CT', band: 'non_hazardous', expanded: 'Traditional shelf-stable items. An in-person water test is described when the home uses a private well.', cap: '$50,000 annual sales cap.' },
  { code: 'DE', band: 'non_hazardous', expanded: 'Pureed fruit and vegetable leathers, also called Fruit / Veggie Strips, plus roasted nut butters and dried whole grains, with standard breads and cookies.' },
  { code: 'DC', band: 'non_hazardous', note: 'The District of Columbia is on the chart, not on the state map.', expanded: 'Shelf-stable baked goods, granolas, and dry mixes, described as limited to direct-to-consumer sales.', cap: '$25,000 annual sales limit.' },
  { code: 'FL', band: 'non_hazardous', expanded: 'Dried pasta, including pasta made with eggs, fruit leathers (the fruit version of Fruit / Veggie Strips), home-blended vegetable flours, fresh or frozen fruits and vegetables baked into baked goods, and homemade marshmallows.' },
  { code: 'GA', band: 'non_hazardous', expanded: 'Publisher summaries say House Bill 398 removed the cottage food license for non-perishable items such as biscuits, confections, and dry herbs.', cap: 'No annual revenue limit is described.' },
  { code: 'HI', band: 'none', note: 'The July 30, 2026 chart says Hawaii has no cottage food law. The map still paints it with the non-potentially hazardous color.', expanded: 'Later publisher summaries describe traditional baked goods, cereals, and candies, limited to direct sales such as farmers markets and roadside stands.', cap: '$20,000 sales cap in those later summaries.' },
  { code: 'ID', band: 'hazardous', expanded: 'The 2026 Direct to Consumer Act, as described on the map page, allows some foods that need time and temperature control without a separate commercial license.' },
  { code: 'IL', band: 'hazardous', note: 'The map paints Illinois green. The chart on that page lists non-potentially hazardous baked goods, jams, jellies, fruit preserves, fruit butters, dry herbs, and dry tea.', expanded: 'Publisher summaries also name acidified and fermented foods, such as hot sauces, salsas, pickles, and kimchi, and home-canned tomato products, when a certified pH test is 4.6 or below.' },
  { code: 'IN', band: 'hazardous', expanded: 'Maple syrup, raw sorghum, honey, cultivated mushrooms, tree nuts, and legumes.' },
  { code: 'IA', band: 'hazardous', expanded: 'A Home Bakery license tier is described as allowing standard baked items to be sold to local restaurants and grocery stores.' },
  { code: 'KS', band: 'non_hazardous', note: 'The chart says Kansas has no statute. Cottage food is a department policy.', expanded: 'Publisher summaries name microgreens, intact leafy shoots, and whole raw poultry or rabbits raised by the home producer.' },
  { code: 'KY', band: 'non_hazardous', expanded: 'Two tiers are described. Cottage Food Processors: standard baked items. Cottage Food Producers who are operating farmers: home-processed dried fruits, mixed nut items, and sorghum syrup.' },
  { code: 'LA', band: 'non_hazardous', expanded: 'Custard and cream-filled bakery products, which most traditional cottage lists keep off a home kitchen.' },
  { code: 'ME', band: 'hazardous', expanded: 'Locally caught whole fish and seafood, only when a local Food Sovereignty town ordinance allows it.' },
  { code: 'MD', band: 'non_hazardous', expanded: 'Chocolate confections, standard pastries, and fruit pies.', cap: '$50,000 sales cap before a commercial facility is described.' },
  { code: 'MA', band: 'non_hazardous', expanded: 'Whole-bean and ground roasted coffee, dried tea blends, and shelf-stable vinegars, with traditional home-baked goods.' },
  { code: 'MI', band: 'non_hazardous', expanded: 'Freeze-dried products made from shelf-stable foods, such as freeze-dried fruits, herbs, and raw vegetables. Chocolate-covered fresh fruit, such as strawberries, bananas, and apple slices, is also described as permitted.' },
  { code: 'MN', band: 'non_hazardous', expanded: 'Publisher summaries say candied and chocolate-dipped fruit, such as candy apples, are on Minnesota’s cottage list.' },
  { code: 'MS', band: 'non_hazardous', expanded: 'A standard shelf-stable item list.', cap: '$35,000 annual cap on gross sales.' },
  { code: 'MO', band: 'non_hazardous', expanded: 'Traditional non-perishable baked goods and jams. Online sales and shipping to customers inside the state are described.' },
  { code: 'MT', band: 'non_hazardous', foodFreedom: true, expanded: FREEDOM_ITEMS, cap: FREEDOM_CAP },
  { code: 'NE', band: 'non_hazardous', expanded: 'Traditional shelf-stable foods sold online and shipped to consumers inside the state.' },
  { code: 'NV', band: 'hazardous', expanded: 'Acidified or canned fruits and vegetables with a registered equilibrium pH of 4.6 or below.' },
  { code: 'NH', band: 'baked_only', note: 'The map marks New Hampshire as baked and confectionery goods only. The chart text also names other shelf-stable foods.', expanded: 'Traditional baked goods, candies, and jams.', cap: '$20,000 a year before a homestead license is described.' },
  { code: 'NJ', band: 'none', note: 'The July 30, 2026 chart says New Jersey has no cottage food law. The map still paints it with the non-potentially hazardous color.', expanded: 'Later publisher summaries say a cottage law permits shelf-stable baked goods, fruit preserves, and hard candies, and prohibits chocolate-dipped fresh fruit and freeze-dried items.' },
  { code: 'NM', band: 'non_hazardous', expanded: 'Standard non-hazardous baked items, dry seasoning rubs, and candies. A local food handler certificate is described.' },
  { code: 'NY', band: 'non_hazardous', expanded: 'A short list is described: double-crust fruit pies are permitted. Pumpkin pies, chocolate-dipped fruits, melted chocolate candy coatings, and nut butters are described as prohibited.' },
  { code: 'NC', band: 'non_hazardous', note: 'The chart says North Carolina has no state cottage statute and points to federal food safety guidelines.', expanded: 'Publisher summaries describe a Home Processor program for standard non-perishable baked goods, candies, and jams, and say a pet anywhere in the home disqualifies the kitchen.', cap: 'No sales cap is described in those summaries.' },
  { code: 'ND', band: 'hazardous', foodFreedom: true, expanded: FREEDOM_ITEMS, cap: FREEDOM_CAP },
  { code: 'OH', band: 'non_hazardous', expanded: 'Publisher summaries say Ohio names cotton candy, waffle cones, pizzelles, popcorn balls, and marshmallow rice cereal treats.' },
  { code: 'OK', band: 'hazardous', foodFreedom: true, expanded: FREEDOM_ITEMS, cap: FREEDOM_CAP },
  { code: 'OR', band: 'non_hazardous', expanded: 'A Home Bakery exemption is described for standard grain-based baked goods. Home-canned jams and processed candies are described as outside that path.' },
  { code: 'PA', band: 'hazardous', expanded: 'Publisher summaries say Pennsylvania’s registration can include shelf-stable meat jerky and fermented or acidified foods such as sauerkraut and kimchi. Most states keep home-processed meat off a cottage list. Confirm the product class with the department.' },
  { code: 'RI', band: 'non_hazardous', expanded: 'The cottage exemption is described as limited to registered farmers or people with specific medical conditions, for shelf-stable baked items and preserves.' },
  { code: 'SC', band: 'baked_only', expanded: 'Waffle cones, cotton candy, and chocolate-coated dry goods such as pretzels or nuts. Fresh chocolate-dipped fruit is described as prohibited.' },
  { code: 'SD', band: 'baked_only', note: 'The map marks South Dakota as baked and confectionery goods only. The chart row does not list allowed foods.', expanded: 'Publisher summaries name standard baked goods and high-acid canned fruits, plus a food safety course after gross sales cross a threshold.', cap: 'The dollar amount of that threshold is not named in these summaries.' },
  { code: 'TN', band: 'hazardous', foodFreedom: true, expanded: FREEDOM_ITEMS, cap: FREEDOM_CAP },
  { code: 'TX', band: 'hazardous', expanded: 'Publisher summaries say Texas allows some refrigerated foods, including some refrigerated baked goods, when the labeling and holding rules are met. Meat, poultry, and seafood stay off that list.' },
  { code: 'UT', band: 'hazardous', foodFreedom: true, expanded: FREEDOM_ITEMS, cap: FREEDOM_CAP },
  { code: 'VT', band: 'baked_only', expanded: 'Shelf-stable baked goods, honey, and maple syrup.', cap: '$30,000 annual revenue limit.' },
  { code: 'VA', band: 'hazardous', expanded: 'Acidified vegetables, such as pickles and salsas, processed in a private home without a formal inspection when the testing labels are used.', cap: '$9,000 cap on that acidified-vegetable path.' },
  { code: 'WA', band: 'hazardous', note: 'The map paints Washington green. The chart on that page lists non-potentially hazardous products such as baked goods, candy, jams, jellies, preserves, fruit butters, vinegars, and dried mixes.', expanded: 'Fruit butters, such as apple or pear butter, are named with jams and jellies.', cap: 'An annual gross sales cap is described. The dollar amount is not named in these summaries.' },
  { code: 'WV', band: 'hazardous', expanded: 'A deregulated list of traditional items is described as needing no permit. Canned acidified and fermented foods are described under a Farmers Market Vendor Permit.' },
  { code: 'WI', band: 'non_hazardous', expanded: 'Non-hazardous baked items, and home-canned high-acid fruits and pickles on a separate path.', cap: 'No annual cap is described for non-hazardous baked items. Home-canned high-acid fruits and pickles are described at a $5,000 annual cap.' },
  { code: 'WY', band: 'non_hazardous', foodFreedom: true, note: 'The map paints Wyoming yellow. The chart on that page also describes sales of potentially hazardous food by the producer, including eggs and dairy, with a notice that the food is not licensed or inspected.', expanded: FREEDOM_ITEMS, cap: FREEDOM_CAP },
];

export const COTTAGE_STATE_DIRECTORY: CottageDirectoryRow[] = ROWS;

export function cottageDirectoryRow(stateCode: string): CottageDirectoryRow | undefined {
  return ROWS.find((row) => row.code === stateCode);
}

export function foodFreedomDirectory(): CottageDirectoryRow[] {
  return ROWS.filter((row) => row.foodFreedom);
}

export function cottageBandLabel(band: CottageMapBand): string {
  switch (band) {
    case 'hazardous':
      return 'Some potentially hazardous foods';
    case 'non_hazardous':
      return 'Non-potentially hazardous foods';
    case 'baked_only':
      return 'Baked and confectionery goods only';
    case 'none':
      return 'No cottage food law on the chart';
  }
}
