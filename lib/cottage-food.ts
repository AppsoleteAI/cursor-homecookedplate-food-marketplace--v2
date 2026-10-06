export type StateFramework =
  | 'traditional_cottage'
  | 'food_freedom'
  | 'limited_food_establishment'
  | 'confirm_locally';

export type RegulatoryTrack =
  | 'whole_produce'
  | 'csa_share'
  | 'cottage_non_tcs'
  | 'shell_eggs'
  | 'temperature_control';

export type FarmChannel =
  | 'farm_pickup'
  | 'community_pickup'
  | 'farm_stand'
  | 'hand_delivery'
  | 'hub_delivery';

export type ComplianceRecord = {
  farmName: string;
  stateCode: string;
  county: string;
  track: RegulatoryTrack;
  sellsDirectToConsumer: boolean;
  sellsWholesale: boolean;
  regulationsConfirmed: boolean;
  agencyName: string;
  statuteNote: string;
  testingProtocol: string;
  testingLab: string;
  testingDate: string;
  permitFee: string;
  permitNumber: string;
  commercialLicense: boolean;
  labelName: string;
  netWeight: string;
  ingredients: string;
  allergens: string;
  disclaimerAccepted: boolean;
  honeyInfantWarning: boolean;
  updatedAt: string;
};

export const PLATFORM_COTTAGE_RULE =
  'Cottage food laws cover homemade, non-TCS, shelf-stable foods sold by the maker directly to the consumer. They do not authorize cooked plates that must be kept hot or cold, and they do not replace farm-stand, egg, meat, or dairy rules. FarmGrownBasket lists farm, garden, and co-op goods apart from cooked plates. The app does not know your county rule, your required test, or your permit fee. Confirm those three with your own agency before you sell.';

export const HOMEMADE_DISCLAIMER =
  'This product is homemade and is not prepared in an inspected food establishment.';

export const US_STATE_NAMES: { code: string; name: string }[] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'],
  ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'],
  ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'],
  ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
].map(([code, name]) => ({ code, name }));

const NAMED_FRAMEWORK: Record<string, StateFramework> = {
  CA: 'traditional_cottage',
  FL: 'traditional_cottage',
  WY: 'food_freedom',
  ND: 'food_freedom',
  UT: 'food_freedom',
  PA: 'limited_food_establishment',
};

export function frameworkForState(stateCode: string): StateFramework {
  return NAMED_FRAMEWORK[stateCode] ?? 'confirm_locally';
}

export function stateName(stateCode: string): string {
  return US_STATE_NAMES.find((state) => state.code === stateCode)?.name ?? stateCode;
}

export function trackLabel(track: RegulatoryTrack): string {
  switch (track) {
    case 'whole_produce':
      return 'Whole produce';
    case 'csa_share':
      return 'CSA share';
    case 'cottage_non_tcs':
      return 'Homemade, shelf-stable';
    case 'shell_eggs':
      return 'Shell eggs';
    case 'temperature_control':
      return 'Refrigerated or hot food';
  }
}

export function channelLabel(channel: FarmChannel): string {
  switch (channel) {
    case 'farm_pickup':
      return 'Farm pickup';
    case 'community_pickup':
      return 'Community pickup';
    case 'farm_stand':
      return 'Farm stand';
    case 'hand_delivery':
      return 'Hand delivery by the producer';
    case 'hub_delivery':
      return 'Weekly hub delivery';
  }
}

export const FARM_CHANNELS: FarmChannel[] = [
  'farm_pickup',
  'community_pickup',
  'farm_stand',
  'hand_delivery',
  'hub_delivery',
];

export function frameworkSummary(framework: StateFramework): string {
  switch (framework) {
    case 'traditional_cottage':
      return 'California and Florida are examples of traditional cottage states: home baking and canning can be allowed with a low barrier, and the state still limits the foods, the sales channels, or the yearly gross. Caps commonly sit somewhere between $5,000 and $150,000. The number that binds you is the one in your current statute, not a figure stored in this app.';
    case 'food_freedom':
      return 'Wyoming, North Dakota, and Utah are examples of food-freedom states. Home producers may sell a wider set of foods, sometimes including refrigerated items, poultry, or hot meals, when the sale stays direct-to-consumer and the label is explicit. Federal meat inspection and interstate commerce rules still apply. Confirm the statute before you list.';
    case 'limited_food_establishment':
      return 'Pennsylvania does not use a traditional cottage food law. It uses a Limited Food Establishment registration through the Department of Agriculture. A published example of that registration is $35 a year, with an in-person home kitchen inspection, no revenue cap, and room for wholesale or interstate shipping when the registration allows the product. Confirm the current fee and your product class with the department before you list.';
    case 'confirm_locally':
      return 'This state is not classified inside FarmGrownBasket. County rules can be stricter than the state. Read the current agriculture or health statute, then record the rule, the test, and the fee below. The app will not guess them for you.';
  }
}

export function regulationDuty(track: RegulatoryTrack, framework: StateFramework): string {
  switch (track) {
    case 'whole_produce':
      return 'Whole, uncut fruits and vegetables are farm products, not cottage foods. You still need the farm-stand, market, scale, and tax rules for your state and county.';
    case 'csa_share':
      return 'A CSA share is a direct subscription with a farm. Produce in the box follows farm-stand rules. Any jam, bread, or other homemade item in the box follows cottage or food-establishment rules on its own, including the label.';
    case 'cottage_non_tcs':
      return framework === 'limited_food_establishment'
        ? 'Shelf-stable homemade foods in Pennsylvania are handled through the Limited Food Establishment registration, not a cottage exemption. Confirm that your product is on the allowed list before you sell it here.'
        : 'Traditional cottage rules almost always allow only non-TCS foods: jams, jellies, fruit preserves, raw honey, maple syrup, dried herbs, dehydrated produce, popcorn, granola, and shelf-stable baked goods. Fresh meat, poultry, seafood, milk, butter, cheese, cream- or custard-filled pastries, cheesecake, low-acid canned vegetables, and cut melon or cut leafy greens are generally outside a home-kitchen cottage exemption.';
    case 'shell_eggs':
      return 'Shell eggs are regulated under state egg laws, not cottage food laws. Grading, carton labels, pack dates, and refrigeration are set by the state. Confirm those before a buyer can pick them up.';
    case 'temperature_control':
      return framework === 'food_freedom'
        ? 'A food-freedom state may allow some refrigerated or hot foods when the sale is direct-to-consumer and labeled. That permission is statutory. It is not a cottage exemption, and it does not waive federal rules for meat that must be inspected.'
        : 'Foods that need refrigeration or hot-holding are not cottage foods in a traditional framework. Selling them requires a commercial kitchen, a health permit, or another license your state names. Cooked plates on HomeCookedPlate follow this same line: a hot or cold meal is not a cottage food.';
  }
}

export function testingProtocol(track: RegulatoryTrack): { title: string; steps: string[] } {
  switch (track) {
    case 'whole_produce':
      return {
        title: 'What to confirm for whole produce',
        steps: [
          'Ask your state agriculture department whether a farm stand, scale certification, or market permit applies.',
          'Record the answer, including “no lab test required,” with the agency name.',
          'Do not cut melon or leafy greens and sell them as whole produce. Cut produce is a different, higher-risk food.',
        ],
      };
    case 'csa_share':
      return {
        title: 'What to confirm for a CSA box',
        steps: [
          'Write down the share season, what a pause does, and how a missed or prorated box is handled.',
          'If the box contains only whole produce, use the produce protocol.',
          'If the box also contains homemade jam, bread, honey, or similar items, complete the cottage protocol and label for each of those items.',
        ],
      };
    case 'cottage_non_tcs':
      return {
        title: 'What to confirm for a cottage food',
        steps: [
          'Confirm the food does not need refrigeration or hot-holding. If it does, it is not a non-TCS cottage food.',
          'For acidified foods such as pickles, salsa, or hot sauce, ask the agency whether you need a process authority and a recorded pH. Do not guess a safe process. Low-acid canned vegetables are generally banned from home kitchens.',
          'For baked goods, confirm they are shelf-stable. Cream, custard, cheesecake, and meat fillings are generally outside cottage rules.',
          'List major allergens (milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame) in plain language.',
          'Keep a gross-sales record so you know when a state cap would push you into a commercial kitchen.',
        ],
      };
    case 'shell_eggs':
      return {
        title: 'What to confirm for shell eggs',
        steps: [
          'Ask the state egg program which grade, size, carton wording, and pack-date rules apply to a small flock.',
          'Confirm the refrigeration temperature required from your property to the buyer’s handoff.',
          'Record the agency answer. A cottage food disclaimer does not replace an egg label.',
        ],
      };
    case 'temperature_control':
      return {
        title: 'What to confirm for refrigerated or hot food',
        steps: [
          'Ask whether your state allows this food from a home kitchen at all.',
          'If the answer is no, the path is a licensed commercial or commissary kitchen and an inspection, not a cottage listing.',
          'If a food-freedom law allows it, record the statute section, the required label, and any sales-channel limit.',
          'Meat and poultry may also require USDA or state inspection. Confirm that separately before listing.',
        ],
      };
  }
}

export function permitFeeGuidance(framework: StateFramework): string {
  switch (framework) {
    case 'limited_food_establishment':
      return 'Permit fees are set by the agency and change. A published example for Pennsylvania Limited Food Establishment registration is $35 per year, plus the cost of the home inspection. Type the fee from your own invoice or from the current department page. Do not copy the example if your invoice says something else.';
    case 'food_freedom':
      return 'Food-freedom states often charge little or nothing to register, and some still charge a local fee or require a food-handler card. The app does not keep a fee schedule. Call the agency, then type the amount you were quoted, or “0 — agency confirmed no fee,” plus the name of the person or page that said so.';
    case 'traditional_cottage':
      return 'Traditional cottage states charge different registration fees, and some counties add their own. The range is not a quote. Type the fee your state or county published for this product, including a food-handler card if they require one.';
    case 'confirm_locally':
      return 'Your permit fee depends on the state, the county, and the product. This app will not invent it. Before listing, record the agency, the fee on the current schedule, and the permit or registration number. If the agency charges nothing, write “0” and name the source.';
  }
}

export function buyerChannelBlock(
  track: RegulatoryTrack,
  channel: FarmChannel,
): string | null {
  if (channel !== 'hub_delivery') return null;
  if (track === 'cottage_non_tcs' || track === 'temperature_control') {
    return 'A warehouse hub is not the maker handing the food to the buyer. Cottage and home-kitchen foods on FarmGrownBasket stay on farm pickup, community pickup, a farm stand, or hand delivery by the producer.';
  }
  return null;
}

export function channelWarning(track: RegulatoryTrack, channel: FarmChannel): string | null {
  if (track === 'shell_eggs' && (channel === 'hub_delivery' || channel === 'hand_delivery')) {
    return 'Eggs usually have to stay refrigerated for the whole handoff. Confirm the temperature rule before you use delivery.';
  }
  if (track === 'cottage_non_tcs' && channel === 'hand_delivery') {
    return 'Many cottage laws allow local delivery only when the person who made the food is the one selling it to the end consumer.';
  }
  return null;
}

const ALCOHOL = /\b(wine|beer|liquor|whiskey|whisky|vodka|rum|cider|alcohol)\b/i;
const TCS_HINT = /\b(chicken|beef|pork|fish|seafood|meat|milk|cheese|cream|custard|cheesecake)\b/i;
const FRUIT_BUTTER = /\b(apple|fruit|nut|seed|pear|pumpkin|peach|plum) butter\b/i;

export function evaluateListing(record: ComplianceRecord | null): { ok: boolean; blocks: string[] } {
  if (!record) {
    return { ok: false, blocks: ['Save your state, county, test, and permit fee before listing.'] };
  }

  const blocks: string[] = [];
  const framework = frameworkForState(record.stateCode);
  const labelBlob = `${record.labelName} ${record.ingredients} ${record.farmName}`;

  if (!record.stateCode) blocks.push('Choose the state where the food is made.');
  if (record.county.trim().length < 2) blocks.push('Enter the county. County rules can be stricter than the state.');
  if (record.farmName.trim().length < 2) blocks.push('Name the farm or home kitchen.');
  if (!record.sellsDirectToConsumer) {
    blocks.push('FarmGrownBasket checkout is direct-to-consumer. Confirm that you are selling to the end consumer.');
  }
  if (record.sellsWholesale && framework !== 'limited_food_establishment') {
    blocks.push('Wholesale to shops or restaurants is outside most cottage laws. Pennsylvania’s Limited Food Establishment framework is the exception named here, and even then you confirm it with the department. Uncheck wholesale, or list only a direct-to-consumer offer.');
  }
  if (!record.regulationsConfirmed) {
    blocks.push('Confirm that you read the current local rule for this product. The app has not verified it.');
  }
  if (record.agencyName.trim().length < 2) blocks.push('Name the agency you confirmed with.');
  if (record.statuteNote.trim().length < 12) {
    blocks.push('Write what the rule actually says for this product, in your own words.');
  }
  if (record.testingProtocol.trim().length < 12) {
    blocks.push('Record the testing protocol, or write why the agency said no lab test is required.');
  }
  if (record.permitFee.trim().length < 1) blocks.push('Record the permit fee from the agency. Use 0 only if they confirmed there is no fee.');
  if (record.permitNumber.trim().length < 2) {
    blocks.push('Record the permit number, or the agency statement that no number is issued.');
  }

  if (ALCOHOL.test(labelBlob) && !/\b(apple|sweet) cider\b/i.test(labelBlob)) {
    blocks.push('Alcohol cannot be listed on HomeCookedPlate or FarmGrownBasket.');
  }

  const dairyButter = /\bbutter\b/i.test(labelBlob) && !FRUIT_BUTTER.test(labelBlob);
  if (record.track === 'cottage_non_tcs' && (TCS_HINT.test(labelBlob) || dairyButter)) {
    blocks.push('Those ingredients are generally time or temperature controlled. They do not belong on a non-TCS cottage listing.');
  }

  if (record.track === 'temperature_control' && framework !== 'food_freedom' && !record.commercialLicense) {
    blocks.push('Refrigerated or hot food needs a commercial or commissary license outside food-freedom states. Cottage rules do not cover it.');
  }

  if (record.track === 'temperature_control' && framework === 'food_freedom' && !record.disclaimerAccepted && !record.commercialLicense) {
    blocks.push('Food-freedom sales still need the explicit homemade label, unless you hold a commercial license.');
  }

  const needsLabel = record.track === 'cottage_non_tcs' || record.track === 'shell_eggs' || record.track === 'temperature_control';
  if (needsLabel) {
    if (record.labelName.trim().length < 2) blocks.push('Put the product name on the label.');
    if (record.netWeight.trim().length < 2) blocks.push('Put the net weight or count on the label.');
    if (record.ingredients.trim().length < 2) blocks.push('List ingredients in descending order by weight.');
    if (record.allergens.trim().length < 2) blocks.push('Declare major allergens, or write “none of the major allergens.”');
    if (!record.disclaimerAccepted) blocks.push(`Accept the homemade disclaimer: “${HOMEMADE_DISCLAIMER}”`);
  }

  if (/honey/i.test(labelBlob) && !record.honeyInfantWarning) {
    blocks.push('Honey needs a label warning that it must not be fed to infants under one year.');
  }

  return { ok: blocks.length === 0, blocks };
}
