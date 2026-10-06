export const CATER_EVENT_RULE =
  'CaterEventDeliver is for licensed catering companies taking group orders. Packages are a fixed price per person, with a minimum headcount. The company drops off the food and sets it up. Cottage food laws do not cover hot catering. This app does not inspect the kitchen, issue the license, hire a driver, or add a 15% to 25% marketplace commission. The fee is the same 10% service fee as the rest of HomeCookedPlate.';

export const DROP_OFF_WINDOWS = [
  'Weekday lunch, 11:00–1:00',
  'Weekday lunch, 12:00–2:00',
  'Afternoon shift, 2:00–4:00',
  'Evening event, 5:00–7:00',
] as const;

export type DropOffWindow = (typeof DROP_OFF_WINDOWS)[number];

export type CaterLicenseRecord = {
  companyName: string;
  stateCode: string;
  city: string;
  county: string;
  healthDepartment: string;
  licenseNumber: string;
  licenseFee: string;
  kitchenNote: string;
  serviceArea: string;
  driverNote: string;
  statuteNote: string;
  handlerCard: string;
  regulationsConfirmed: boolean;
  cottageDoesNotApply: boolean;
  companyArrangesDropoff: boolean;
  updatedAt: string;
};

const ALCOHOL = /\b(wine|beer|liquor|whiskey|whisky|vodka|rum|cocktail|alcohol)\b/i;
const HOME_KITCHEN = /\b(home kitchen|cottage|mehko|my house|residential kitchen)\b/i;

export function evaluateCaterLicense(record: CaterLicenseRecord | null): { ok: boolean; blocks: string[] } {
  if (!record) {
    return { ok: false, blocks: ['Save the commercial catering license, kitchen, and drop-off plan before listing a package.'] };
  }

  const blocks: string[] = [];
  if (record.companyName.trim().length < 2) blocks.push('Name the catering company.');
  if (!record.stateCode) blocks.push('Choose the state where the food is prepared.');
  if (record.city.trim().length < 2) blocks.push('Enter the city on the catering license.');
  if (record.county.trim().length < 2) blocks.push('Enter the county. A city health department can be stricter than the state.');
  if (record.healthDepartment.trim().length < 2) blocks.push('Name the health department that issued, or must issue, the catering license.');
  if (record.licenseNumber.trim().length < 2) blocks.push('Record the license number, or the agency statement that the application is still open.');
  if (record.licenseFee.trim().length < 1) blocks.push('Record the license fee from the agency. Use 0 only if they confirmed there is no fee.');
  if (record.kitchenNote.trim().length < 8) blocks.push('Name the licensed commercial kitchen and its address.');
  if (HOME_KITCHEN.test(record.kitchenNote)) {
    blocks.push('Hot catering drop-off needs a commercial kitchen license. A cottage or home-kitchen permit is not this license.');
  }
  if (record.serviceArea.trim().length < 8) blocks.push('Write the cities where this license lets you cater. A license in one county does not travel.');
  if (record.driverNote.trim().length < 8) {
    blocks.push('Write who drops off and sets up the trays: your staff, or a drop-off service you hired. This app does not book the driver.');
  }
  if (record.statuteNote.trim().length < 12) blocks.push('Write what the health department said about catering from this kitchen.');
  if (record.handlerCard.trim().length < 4) blocks.push('Record the food-handler or food-manager card, or the agency statement that none is required.');
  if (!record.regulationsConfirmed) blocks.push('Confirm that you read the current catering rule. The app has not verified it.');
  if (!record.cottageDoesNotApply) blocks.push('Confirm that cottage food law is not the license for this catering company.');
  if (!record.companyArrangesDropoff) blocks.push('CaterEventDeliver orders are dropped off and set up by the catering company.');
  if (ALCOHOL.test(`${record.companyName} ${record.statuteNote}`)) {
    blocks.push('Alcohol cannot be sold on HomeCookedPlate.');
  }

  return { ok: blocks.length === 0, blocks };
}

export function evaluateCaterPackage(
  license: CaterLicenseRecord | null,
  item: {
    name: string;
    pricePerPerson: number;
    minimumHeadcount: number;
    summary: string;
    ingredients: string;
    allergens: string;
  },
): { ok: boolean; blocks: string[] } {
  const licenseCheck = evaluateCaterLicense(license);
  const blocks = [...licenseCheck.blocks];
  if (item.name.trim().length < 2) blocks.push('Name the package.');
  if (!Number.isFinite(item.pricePerPerson) || item.pricePerPerson <= 0) blocks.push('Enter a per-person price greater than zero.');
  if (!Number.isInteger(item.minimumHeadcount) || item.minimumHeadcount < 8) {
    blocks.push('Set a minimum headcount of at least 8. Single plates belong on the cooked-plate menu.');
  }
  if (item.summary.trim().length < 8) blocks.push('Describe the package.');
  if (item.ingredients.trim().length < 2) blocks.push('List the ingredients.');
  if (item.allergens.trim().length < 2) blocks.push('Declare major allergens, or write “none of the major allergens.”');
  if (ALCOHOL.test(`${item.name} ${item.ingredients} ${item.summary}`)) {
    blocks.push('Alcohol cannot be listed on a CaterEventDeliver package.');
  }
  return { ok: blocks.length === 0, blocks };
}
