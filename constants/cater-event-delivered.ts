export type DropoffWindow = {
  day: string;
  hours: string;
  place: string;
};

export type CaterCompany = {
  id: string;
  name: string;
  city: string;
  stateCode: string;
  county: string;
  zip: string;
  focus: string;
  summary: string;
  image: string;
  accepting: boolean;
  dropoffNote: string;
  windows: DropoffWindow[];
};

export type CaterPackage = {
  id: string;
  companyId: string;
  name: string;
  pricePerPerson: number;
  minimumHeadcount: number;
  summary: string;
  ingredients: string;
  allergens: string;
  image: string;
};

export const CATER_COMPANIES: CaterCompany[] = [
  {
    id: 'harbor-table',
    name: 'Harbor Table',
    city: 'San Diego',
    stateCode: 'CA',
    county: 'San Diego',
    zip: '92101',
    focus: 'Workplace lunch',
    summary: 'A licensed catering kitchen dropping boxed lunches and trays at downtown offices. Orders are priced per person, with a minimum headcount.',
    image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=900',
    accepting: true,
    dropoffNote: 'Harbor Table’s own staff drops the trays and sets the buffet. This app does not send a courier.',
    windows: [
      { day: 'Weekdays', hours: '11:30–1:00', place: 'Downtown office towers' },
      { day: 'Weekdays', hours: '12:00–2:00', place: 'Waterfront workplaces' },
    ],
  },
  {
    id: 'lantern-service',
    name: 'Lantern Service',
    city: 'Austin',
    stateCode: 'TX',
    county: 'Travis',
    zip: '78701',
    focus: 'Medical offices',
    summary: 'Group meals for clinics and workplace managers. Packages are a fixed price per person, not an à la carte restaurant menu.',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=900',
    accepting: true,
    dropoffNote: 'Drop-off and setup are on the catering company’s ticket. Confirm the suite and a contact who will meet the trays.',
    windows: [
      { day: 'Weekdays', hours: '11:00–1:00', place: 'Medical offices and clinics' },
      { day: 'Thursday', hours: '5:00–7:00', place: 'After-hours staff meals' },
    ],
  },
  {
    id: 'northline-events',
    name: 'Northline Events',
    city: 'Chicago',
    stateCode: 'IL',
    county: 'Cook',
    zip: '60601',
    focus: 'Events',
    summary: 'Fixed-price event packages for meetings and receptions. Headcount sets the order. The kitchen is commercial, not a cottage operation.',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900',
    accepting: true,
    dropoffNote: 'Northline delivers and sets the chafing dishes. A 15% to 25% marketplace commission is not added on top of the service fee.',
    windows: [
      { day: 'Weekdays', hours: '12:00–2:00', place: 'Loop meeting rooms' },
      { day: 'Friday', hours: '5:00–7:00', place: 'Reception halls the company already serves' },
    ],
  },
  {
    id: 'maple-room',
    name: 'Maple Room',
    city: 'Salt Lake City',
    stateCode: 'UT',
    county: 'Salt Lake',
    zip: '84101',
    focus: 'Breakfast meetings',
    summary: 'Breakfast trays for offices. The company is not taking new drop-offs today. The calendar still shows the usual windows.',
    image: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=900',
    accepting: false,
    dropoffNote: 'Orders open only while the company marks itself as accepting drop-offs.',
    windows: [
      { day: 'Tuesday–Friday', hours: '8:00–10:00', place: 'Downtown conference rooms' },
    ],
  },
  {
    id: 'shift-pantry',
    name: 'Shift Pantry',
    city: 'Philadelphia',
    stateCode: 'PA',
    county: 'Philadelphia',
    zip: '19107',
    focus: 'Scheduled shift meals',
    summary: 'Recurring drop-off lunches for a building’s shift calendar. Closed for new orders today. Cottage food rules do not cover this hot service.',
    image: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=900',
    accepting: false,
    dropoffNote: 'Come back when the company is accepting orders. The posted calendar is a plan, not a confirmed delivery.',
    windows: [
      { day: 'Weekdays', hours: '11:00–1:00', place: 'Center City offices' },
      { day: 'Weekdays', hours: '2:00–4:00', place: 'Afternoon shift dining' },
    ],
  },
];

export const CATER_PACKAGES: CaterPackage[] = [
  {
    id: 'harbor-grain',
    companyId: 'harbor-table',
    name: 'Grain bowl lunch',
    pricePerPerson: 16,
    minimumHeadcount: 15,
    summary: 'A boxed grain bowl for a workplace lunch. Price is per person.',
    ingredients: 'Rice, roasted vegetables, chicken, greens, olive oil',
    allergens: 'None of the major allergens',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  },
  {
    id: 'harbor-sandwich',
    companyId: 'harbor-table',
    name: 'Sandwich tray',
    pricePerPerson: 13,
    minimumHeadcount: 12,
    summary: 'Assorted sandwiches, cut and labeled, dropped as a tray.',
    ingredients: 'Wheat bread, turkey, cheese, lettuce, tomato',
    allergens: 'Wheat, milk',
    image: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=800',
  },
  {
    id: 'lantern-taco',
    companyId: 'lantern-service',
    name: 'Taco bar for the office',
    pricePerPerson: 14,
    minimumHeadcount: 20,
    summary: 'A fixed-price taco bar. Headcount is the order. Not an à la carte menu.',
    ingredients: 'Corn tortillas, chicken, beans, salsa, cheese, onion',
    allergens: 'Milk',
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
  },
  {
    id: 'lantern-clinic',
    companyId: 'lantern-service',
    name: 'Clinic boxed lunch',
    pricePerPerson: 15,
    minimumHeadcount: 10,
    summary: 'Individual boxes for a medical office that cannot share a buffet.',
    ingredients: 'Rice, chicken, vegetables, fruit',
    allergens: 'None of the major allergens',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
  },
  {
    id: 'northline-buffet',
    companyId: 'northline-events',
    name: 'Dinner buffet',
    pricePerPerson: 28,
    minimumHeadcount: 25,
    summary: 'Hot buffet with setup. The company brings the trays and serves the headcount you enter.',
    ingredients: 'Chicken, rice, roasted vegetables, wheat rolls, butter',
    allergens: 'Wheat, milk',
    image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800',
  },
  {
    id: 'maple-breakfast',
    companyId: 'maple-room',
    name: 'Breakfast tray',
    pricePerPerson: 11,
    minimumHeadcount: 10,
    summary: 'Pastry, fruit, and yogurt. Offered when Maple Room is accepting drop-offs.',
    ingredients: 'Wheat pastry, fruit, yogurt, milk',
    allergens: 'Wheat, milk',
    image: 'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=800',
  },
  {
    id: 'shift-hot',
    companyId: 'shift-pantry',
    name: 'Shift hot lunch',
    pricePerPerson: 15,
    minimumHeadcount: 20,
    summary: 'A scheduled hot lunch for a shift. The company is not accepting orders today.',
    ingredients: 'Chicken, rice, greens, olive oil',
    allergens: 'None of the major allergens',
    image: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800',
  },
];

export function getCompany(id: string): CaterCompany | undefined {
  return CATER_COMPANIES.find((company) => company.id === id);
}

export function getPackage(id: string): CaterPackage | undefined {
  return CATER_PACKAGES.find((item) => item.id === id);
}

export function packagesForCompany(companyId: string): CaterPackage[] {
  return CATER_PACKAGES.filter((item) => item.companyId === companyId);
}

export function companiesNearZip(zip: string): CaterCompany[] {
  const digits = zip.replace(/\D/g, '');
  if (digits.length < 3) return CATER_COMPANIES;
  return CATER_COMPANIES.filter((company) => company.zip.startsWith(digits.slice(0, 3)));
}
