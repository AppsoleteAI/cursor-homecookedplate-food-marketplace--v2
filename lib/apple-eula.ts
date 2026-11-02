export const DEVELOPER_NAME = 'Appsolete';
export const DEVELOPER_EMAIL = 'support@homecookedplate.com';

/** Apple app license only. See the purpose limit in docs/PAID_APPLICATIONS_EXHIBITS.md. */
export const DEVELOPER_POSTAL_ADDRESS = '120 Miller Ave, B, Rankin, PA 15104, United States';

/** Apple app license only. See the purpose limit in docs/PAID_APPLICATIONS_EXHIBITS.md. */
export const DEVELOPER_TELEPHONE = '+1 412-657-1783';

export function appleLicenseParagraphs(): string[] {
  const contact = [
    `${DEVELOPER_NAME} offers the HomeCookedPlate app.`,
    `Questions, complaints, and claims about the app go to ${DEVELOPER_EMAIL}.`,
    DEVELOPER_POSTAL_ADDRESS ? `Postal address: ${DEVELOPER_POSTAL_ADDRESS}.` : '',
    DEVELOPER_TELEPHONE ? `Telephone: ${DEVELOPER_TELEPHONE}.` : '',
  ].filter(Boolean);
  return [
    'This license is between you and Appsolete only. It is not an agreement with Apple. Appsolete, not Apple, is responsible for the HomeCookedPlate app and what is in it. These terms do not set usage rules that conflict with the Apple Media Services Terms and Conditions.',
    'The license is a non-transferable license to use HomeCookedPlate on Apple-branded products you own or control, as the Apple Media Services Terms and Conditions allow. That includes access Apple itself allows through Family Sharing, volume purchase, or Legacy Contacts. A Premium membership still belongs to the one HomeCookedPlate account that completed the purchase.',
    'Appsolete provides maintenance and support for the app. Apple has no obligation to provide maintenance or support for HomeCookedPlate.',
    'Appsolete is responsible for any warranty on the app, to the extent the law does not allow that warranty to be disclaimed. If the app fails to conform to an applicable warranty, you may notify Apple, and Apple will refund the purchase price of the app to you. To the maximum extent the law allows, Apple has no other warranty obligation for the app. Any other claim from a failure to conform to a warranty is Appsolete’s responsibility.',
    'Appsolete, not Apple, is responsible for claims about the app or your possession and use of it. That includes product liability claims, a claim that the app fails to meet a legal or regulatory requirement, and claims under consumer protection or privacy law. These terms do not limit Appsolete’s liability to you beyond what the law allows.',
    'If a third party claims that the app, or your possession and use of it, infringes that party’s intellectual property, Appsolete, not Apple, is responsible for the investigation, defense, settlement, and discharge of that claim.',
    'You represent and warrant that you are not located in a region that is subject to a U.S. Government embargo or that the U.S. Government has designated as a “terrorist supporting” region, and that you are not listed on any U.S. Government list of prohibited or restricted parties.',
    contact.join(' '),
    'You must comply with third-party terms that apply when you use the app. Your wireless data agreement is one of those terms.',
    'You and Appsolete agree that Apple and Apple’s subsidiaries are third-party beneficiaries of this license. After you accept it, Apple has the right, and is deemed to have accepted the right, to enforce this license against you as a third-party beneficiary.',
  ];
}
