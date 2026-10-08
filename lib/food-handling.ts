export const FOOD_HANDLING_NOTICE =
  'These are published handling summaries for anyone cooking or picking up food. HomeCookedPlate is not affiliated with the agencies or the other pages listed below. A county health department can use a stricter number than the one printed here. This page is not a permit, not an inspection, and not a promise that a meal was held at these temperatures.';

export type HandlingBullet = string;

export type HandlingBlock = {
  title: string;
  body?: string;
  bullets: HandlingBullet[];
};

export const FOOD_HANDLING_SECTIONS: { title: string; intro?: string; blocks: HandlingBlock[] }[] = [
  {
    title: 'Clean, separate, cook, chill',
    intro:
      'USDA describes safe food handling as four practices: clean, separate, cook, and chill. The steps below are the practical version of that list.',
    blocks: [
      {
        title: 'Clean',
        bullets: [
          'Wash hands with warm water and soap for at least 20 seconds before, during, and after preparing food, and again before eating.',
          'Wash counters, cutting boards, and utensils with hot, soapy water after each food, especially after raw meat, poultry, seafood, or eggs.',
          'Rinse fresh fruits and vegetables under running tap water before eating or peeling them. Soap is for hands and tools, not for produce.',
        ],
      },
      {
        title: 'Separate',
        bullets: [
          'Keep raw meat, poultry, seafood, and eggs away from food that is ready to eat.',
          'Use a different cutting board and plate for raw meat than the one you use for cooked food or produce.',
          'In the refrigerator, put raw meat and poultry on the lowest shelf in a sealed container so juice cannot drip onto other food.',
        ],
      },
      {
        title: 'Cook',
        bullets: [
          'Use a food thermometer in the thickest part of the food. Color is not a doneness test.',
          'On the USDA home chart: 145°F for whole cuts of beef, pork, veal, and lamb, then rest 3 minutes; 160°F for ground meat; 165°F for all poultry.',
          'A request such as “medium rare” is a preference. It does not replace those temperatures for poultry, ground meat, stuffed food, or leftovers.',
        ],
      },
      {
        title: 'Chill',
        bullets: [
          'Refrigerate perishable food within 2 hours of cooking or pickup. Use 1 hour if the air around the food is above 90°F.',
          'Keep the refrigerator at 40°F or below and the freezer at 0°F or below.',
          'Thaw in the refrigerator, in cold water that you change every 30 minutes, or in the microwave if you cook it right away. Do not thaw on the counter.',
        ],
      },
    ],
  },
  {
    title: 'Temperatures',
    intro:
      'Two public charts use different edges. When they disagree, use the colder number for cold food and the hotter number for hot food. A pickup plate follows the 2-hour home rule, not a food-service time plan.',
    blocks: [
      {
        title: 'While the food is waiting to be eaten',
        body:
          'Many health departments follow the FDA Food Code for holding. Cold perishable food stays at 41°F (5°C) or below. Hot food stays at 135°F (57°C) or above. Bacteria grow quickly between 41°F and 135°F. USDA consumer pages often draw that band from 40°F to 140°F. A plate that is only warm, or a cold dish that has gone soft, has left the safe side of both charts.',
        bullets: [
          'Cold holding: 41°F or below.',
          'Hot holding: 135°F or above.',
          'Refrigerator: 40°F or below. Freezer: 0°F or below.',
        ],
      },
      {
        title: 'How long it may sit out',
        body:
          'At home and after pickup, perishable food goes into the refrigerator within 2 hours, or within 1 hour if the surrounding air is above 90°F. Some food-service rules allow a written 4-hour limit for food held without temperature control. That 4-hour practice is not the rule for a plate you just picked up.',
        bullets: [],
      },
      {
        title: 'USDA home cooking chart',
        body:
          'Check the center with a clean thermometer before the food leaves the heat. These are the consumer minimums on the USDA and FoodSafety.gov charts.',
        bullets: [
          '165°F: poultry, whether whole or ground, and leftovers reheated for the table.',
          '160°F: ground beef, pork, veal, and lamb.',
          '145°F and a 3-minute rest: whole cuts of beef, pork, veal, and lamb, and fresh ham.',
          '145°F: fish, or cook until the flesh is opaque and flakes.',
        ],
      },
      {
        title: 'Food-service chart, when a permit uses it',
        body:
          'A licensed kitchen is often inspected against the FDA Food Code, which times some temperatures in seconds. Ground meat on that chart is 155°F, not the 160°F home number. If you are cooking at home for a pickup, use the USDA home chart. If an inspector gave you the food-code chart, follow that chart for that kitchen.',
        bullets: [
          '165°F: poultry, stuffed meat, casseroles, and food reheated for hot holding.',
          '155°F: ground meats, mechanically tenderized or injected meats, and shell eggs that will be hot-held.',
          '145°F and a 3-minute rest: whole cuts of beef, pork, veal, lamb, and raw or fresh ham.',
          '145°F: fish and seafood.',
        ],
      },
    ],
  },
  {
    title: 'Cross-contact',
    intro:
      'Cross-contamination is germs or toxins moving from one food, tool, or person onto another. Cross-contact is the same kind of transfer for an allergen. Either one can make the food unsafe for the person who eats it.',
    blocks: [
      {
        title: 'How it happens',
        bullets: [
          'Raw meat juice drips onto fruit, salad, or a cooked plate in the fridge.',
          'The same unwashed knife or board is used for raw chicken and then for vegetables.',
          'Hands touch raw meat and then touch a ready-to-eat food, a utensil, or a counter.',
          'A shared spoon, fryer, or glove carries peanuts, milk, eggs, wheat, soy, fish, shellfish, tree nuts, or sesame onto a plate that was supposed to be free of that allergen. That contact can cause a severe allergic reaction.',
        ],
      },
      {
        title: 'What to do',
        bullets: [
          'Wash hands for 20 seconds before and after handling raw food, and between an allergen and a plate that must avoid it.',
          'Use separate boards and plates for raw meat and for food that will not be cooked again.',
          'Tell the cook about an allergy before the order, and read the ingredient list. A cooked plate on this app lists ingredients. Ask if the allergen field is blank.',
          'Illness from Salmonella, E. coli, or Listeria can include nausea, cramps, diarrhea, and fever. Do not taste food to decide whether it is safe. Smell and appearance miss germs that have not changed the food.',
        ],
      },
    ],
  },
  {
    title: 'Gloves',
    intro:
      'Gloves do not replace handwashing. Wash hands and wrists with soap and water for at least 20 seconds, then put on a new disposable glove.',
    blocks: [
      {
        title: 'How to use them',
        bullets: [
          'Change gloves as soon as they tear or become dirty, and when you switch tasks, such as from raw meat to food that is ready to eat.',
          'During one continuous task, replace gloves at least every 4 hours.',
          'Disposable gloves are single-use. Do not wash them, reuse them, or try to sanitize them.',
        ],
      },
      {
        title: 'Materials',
        bullets: [
          'Nitrile is durable and avoids latex. It is a common choice for prep.',
          'Polyethylene is a light glove for short assembly steps where you change gloves often.',
          'Vinyl is latex-free and used for short tasks. It tears more easily than nitrile.',
          'Latex fits closely and can cause an allergy. Some places restrict it. Do not use latex on a plate for someone with a latex allergy.',
        ],
      },
    ],
  },
  {
    title: 'Containers',
    intro:
      'Use a food-grade container, and do not heat food in a material that is not meant for heat. The recycling number is a resin code, not a promise that the container is safe for every use.',
    blocks: [
      {
        title: 'Plastics',
        bullets: [
          'Resin codes 2 (HDPE), 4 (LDPE), and 5 (PP) are the ones commonly treated as the lower-risk choices for food contact. Code 5, polypropylene, is the usual reusable storage plastic.',
          'Avoid codes 3, 6, and 7 for storing food. Those families are the ones associated with phthalates, polystyrene, or BPA.',
          'Move food into glass or ceramic before you microwave it, even when a plastic tub says microwave-safe.',
          'Throw out plastic that is deeply scratched, cracked, or stained.',
          'A cup-and-fork mark means the maker claims food contact. It still does not mean the tub can go in the microwave.',
        ],
      },
      {
        title: 'Other materials',
        bullets: [
          'Glass and stainless steel do not leach the way plastic can, and they tolerate heat.',
          'Food-grade silicone is used for heat changes. Use a product that says it is food grade.',
        ],
      },
      {
        title: 'Foam takeout boxes',
        body:
          'The foam clamshell used for takeout is expanded polystyrene, resin code 6. “Styrofoam” is a brand name for building insulation, not the name of that box. Styrene can move into food more readily when the box is hot or the food is oily. Foam can also shed small plastic particles into hot food.',
        bullets: [
          'Do not microwave food in a foam box or in any plastic that is not meant for the microwave.',
          'Let boiling or very oily food cool for a few minutes before it goes into foam.',
          'Move the food onto a glass, ceramic, or paper plate when you get home, then refrigerate it within the 2-hour window.',
        ],
      },
    ],
  },
  {
    title: 'Recalls',
    intro:
      'A recall or outbreak notice is not something this app checks for you. Look it up before you eat a packaged ingredient that has been named.',
    blocks: [
      {
        title: 'Where notices are posted',
        bullets: [
          'FoodSafety.gov gathers recall and outbreak notices from the federal agencies.',
          'FDA covers most foods. USDA FSIS covers meat, poultry, and processed egg products.',
          'Notices include germs such as Salmonella, Listeria, and E. coli, an allergen that was left off a label, and objects that do not belong in the food.',
        ],
      },
      {
        title: 'What to do',
        bullets: [
          'Do not eat a recalled food. Match the brand, lot code, and UPC on the package to the notice before you throw it out or take it back.',
          'If a homemade plate used a recalled ingredient, treat that plate as part of the notice and do not serve it.',
        ],
      },
    ],
  },
];

export const FOOD_HANDLING_SOURCES: { name: string; detail: string; url: string }[] = [
  {
    name: 'USDA FSIS — Steps to Keep Food Safe',
    detail: 'Clean, separate, cook, and chill, including the 2-hour rule.',
    url: 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/steps-keep-food-safe',
  },
  {
    name: 'USDA — Safe temperature chart',
    detail: 'Home minimum internal temperatures, including 160°F for ground meat and 165°F for poultry.',
    url: 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart',
  },
  {
    name: 'FoodSafety.gov — Safe minimum temperatures',
    detail: 'The same consumer cooking chart, with the 3-minute rest for whole cuts.',
    url: 'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures',
  },
  {
    name: 'USDA — The Big Thaw',
    detail: 'Refrigerator, cold water, or microwave. Not the counter.',
    url: 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/big-thaw',
  },
  {
    name: 'FDA — Safe food handling',
    detail: 'Consumer handling, including produce rinsing and the danger of the temperature band where bacteria grow.',
    url: 'https://www.fda.gov/food/buy-store-serve-safe-food/safe-food-handling',
  },
  {
    name: 'CDC — Preventing food poisoning',
    detail: 'Clean, separate, cook, and chill for people eating at home.',
    url: 'https://www.cdc.gov/food-safety/prevention/index.html',
  },
  {
    name: 'FoodSafety.gov — Recalls and outbreaks',
    detail: 'Current notices gathered from FDA and USDA.',
    url: 'https://www.foodsafety.gov/recalls-and-outbreaks',
  },
  {
    name: 'FDA — Recalls, market withdrawals, and safety alerts',
    detail: 'Most foods other than meat, poultry, and processed egg products.',
    url: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
  },
  {
    name: 'USDA FSIS — Recalls',
    detail: 'Meat, poultry, and processed egg products.',
    url: 'https://www.fsis.usda.gov/recalls',
  },
  {
    name: 'South Dakota State University Extension — Disposable gloves',
    detail: 'Wash hands before gloves. Do not wash or reuse disposable gloves.',
    url: 'https://extension.sdstate.edu/disposable-gloves-guidelines-food-handlers',
  },
  {
    name: 'FARE — Avoiding cross-contact',
    detail: 'Allergen transfer is a separate problem from germs.',
    url: 'https://www.foodallergy.org/resources/avoiding-cross-contact',
  },
  {
    name: 'Center for Environmental Health — Polystyrene food containers',
    detail: 'Heat and oily food increase movement of styrene from foam packaging.',
    url: 'https://ceh.org/wp-content/uploads/2024/10/Polystyrene-Disposable-Food-Containers-and-Contaminated-Food.pdf',
  },
];
