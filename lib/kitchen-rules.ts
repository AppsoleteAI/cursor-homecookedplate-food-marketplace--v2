export const KITCHEN_RULES_NOTICE =
  'HomeCookedPlate is not affiliated with, partnered with, or endorsed by any directory, publisher, or agency linked on this page. We do not guarantee that a listing, rate, license, statute, cap, or management contact is accurate or current. This is not a complete list of kitchens or of food laws. Do your own due diligence. Confirm the facility and the rule with the kitchen and with your local, county, state, and federal authorities before you cook or list.';

export type ExternalSource = {
  name: string;
  url: string;
  detail: string;
};

export const COMMISSARY_DIRECTORIES: ExternalSource[] = [
  {
    name: 'CommissaryFinder',
    url: 'https://www.commissaryfinder.com/',
    detail: 'A public directory of commissary and commercial kitchens for rent. Listings describe where a fact came from, such as a kitchen’s published rates or a county approved-commissary list.',
  },
  {
    name: 'CommercialKitchens.org map',
    url: 'https://commercialkitchens.org/map',
    detail: 'A visual directory of shared and community kitchens. The site describes a national map you can filter by state.',
  },
  {
    name: 'Shared Kitchen Locator',
    url: 'https://sharedkitchenlocator.com/',
    detail: 'A directory aimed at shared-use, commissary, and ghost-kitchen space, including hourly and monthly rentals.',
  },
  {
    name: 'Opening Day Kit commissary finder',
    url: 'https://openingdaykit.com/commissary-kitchen-finder/',
    detail: 'A planning page that republishes kitchen counts and national cost bands from other directories. Treat any dollar figure there as a budget range, not a quote.',
  },
  {
    name: 'Specialty Food Co-Packers commercial kitchens',
    url: 'https://www.specialtyfoodcopackers.com/Commercial-Kitchens.html',
    detail: 'A state-by-state list of commercial kitchens. The publisher says the directory is still being filled in.',
  },
  {
    name: 'CloudKitchens',
    url: 'https://cloudkitchens.com/',
    detail: 'A company that rents private, move-in-ready commercial kitchens for delivery, takeout, and food production. Confirm the location, the permit, and the rate with CloudKitchens and with your health department.',
  },
];

export const OTHER_KITCHEN_STARTING_POINTS: ExternalSource[] = [
  {
    name: 'The Kitchen Door',
    url: 'https://www.thekitchendoor.com',
    detail: 'A public directory of commissary and shared-use kitchens, often cited as a source for state kitchen counts. Confirm each facility yourself.',
  },
  {
    name: 'Pennsylvania Department of Agriculture, food',
    url: 'https://www.pa.gov/agencies/pda/food.html',
    detail: 'The state agriculture site for food establishments, manufacturing, and related registrations inside Pennsylvania.',
  },
  {
    name: 'Pennsylvania Limited Food Establishment',
    url: 'https://www.pa.gov/agencies/pda/food/food-safety/limited-food-establishment-',
    detail: 'The registration path for certain non-hazardous, shelf-stable foods made in a Pennsylvania home. It is not a permit for hot meals.',
  },
];

export const LAW_BACKGROUND_SOURCES: ExternalSource[] = [
  {
    name: 'MEHKO laws explained',
    url: 'https://findhomegrown.com/blog/mehko-laws-explained',
    detail: 'A publisher summary of microenterprise home kitchen laws, county opt-in, and volume caps.',
  },
  {
    name: 'Food freedom states',
    url: 'https://findhomegrown.com/blog/food-freedom-states-sell-from-home',
    detail: 'A publisher summary of states that broadly allow direct-to-consumer home cooking.',
  },
  {
    name: 'Cottage food laws by state',
    url: 'https://findhomegrown.com/blog/cottage-food-laws-by-state',
    detail: 'A publisher summary of cottage rules, which generally stop at shelf-stable foods.',
  },
  {
    name: 'Pennsylvania cottage and home-kitchen summary',
    url: 'https://findhomegrown.com/blog/cottage-food-law-pennsylvania',
    detail: 'A publisher summary of Pennsylvania’s Limited Food Establishment limits.',
  },
  {
    name: 'The Food Corridor, MEHKOs in 2026',
    url: 'https://www.thefoodcorridor.com/blog/mehkos-2026-2/',
    detail: 'An industry summary of where home kitchen permits stand.',
  },
  {
    name: 'The Food Corridor, food trucks and commissaries',
    url: 'https://www.thefoodcorridor.com/blog/do-food-trucks-need-a-commissary-kitchen/',
    detail: 'An industry summary of why mobile vendors are usually tied to a licensed kitchen.',
  },
  {
    name: 'Cottage food law guide',
    url: 'https://butterbase.app/blog/cottage-food-law-guide-2026/',
    detail: 'A publisher roundup of cottage and food-freedom changes.',
  },
  {
    name: 'CottageCMS state laws',
    url: 'https://cottagecms.com/state-laws',
    detail: 'A publisher index of state cottage and home-food rules.',
  },
  {
    name: 'Farm-to-Consumer cottage foods map',
    url: 'https://www.farmtoconsumer.org/cottage-foods-map/',
    detail: 'An advocacy map of cottage and food-freedom laws. Read the statute, not only the map.',
  },
  {
    name: 'COOK Alliance MEHKO questions',
    url: 'https://www.cookalliance.org/frequently-asked-questions',
    detail: 'Questions and answers from a California home-cooking organization.',
  },
  {
    name: 'MEHKO.org',
    url: 'https://mehko.org',
    detail: 'A site focused on microenterprise home kitchen operations.',
  },
  {
    name: 'Street Legal, commissary requirements by state',
    url: 'https://streetlegal.io/blog/commissary-kitchen-requirements-by-state',
    detail: 'An industry summary aimed at mobile food vendors. It is not a statute.',
  },
];

export const COMMISSARY_REQUIRED_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
];
