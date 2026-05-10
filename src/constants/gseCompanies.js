// Authoritative GSE company registry.
// domain is used for Clearbit logo API and Google S2 favicon fallback.
// Keep this file as the single source of truth for logos across the app.
export const GSE_COMPANIES = {
  ACCESS:   { name: 'Access Bank Ghana',               domain: 'accessbankplc.com' },
  ADB:      { name: 'Agricultural Development Bank',   domain: 'agricbank.com' },
  ALLGH:    { name: 'Atlantic Lithium Limited',         domain: 'atlanticlithium.com.au' },
  ASG:      { name: 'Asante Gold Corporation',          domain: 'asantegold.com' },
  BOPP:     { name: 'Benso Oil Palm Plantation',        domain: 'boppplc.com' },
  CAL:      { name: 'CalBank Plc',                      domain: 'calbank.net' },
  CPC:      { name: 'Cocoa Processing Company',         domain: 'cpc.com.gh' },
  DASPHARMA:{ name: 'Dannex Ayrton Starwin Plc',        domain: 'dasplcgh.com' },
  EGH:      { name: 'Ecobank Ghana',                    domain: 'ecobank.com' },
  EGL:      { name: 'Enterprise Group',                 domain: 'enterprisegroup.net.gh' },
  ETI:      { name: 'Ecobank Transnational',            domain: 'ecobank.com' },
  FML:      { name: 'Fan Milk Plc',                     domain: 'danone.com' },
  GCB:      { name: 'GCB Bank',                         domain: 'gcbbank.com.gh' },
  GGBL:     { name: 'Guinness Ghana Breweries',         domain: 'guinnessghana.com' },
  GOIL:     { name: 'GOIL Plc',                         domain: 'goil.com.gh' },
  HFC:      { name: 'Republic Bank Ghana',              domain: 'republicghana.com' },
  MLC:      { name: 'Mechanical Lloyd Company',         domain: 'mechlloyd.com' },
  MTNGH:    { name: 'MTN Ghana',                        domain: 'mtn.com.gh' },
  PZC:      { name: 'PZ Cussons Ghana',                 domain: 'pzcussons.com.gh' },
  RBGH:     { name: 'Republic Bank Ghana',              domain: 'republicghana.com' },
  SCB:      { name: 'Standard Chartered Ghana',         domain: 'sc.com' },
  SIC:      { name: 'SIC Insurance',                    domain: 'sic-gh.com' },
  SOGEGH:   { name: 'Societe Generale Ghana',           domain: 'societegenerale.com' },
  TOTAL:    { name: 'TotalEnergies Marketing Ghana',    domain: 'totalenergies.com.gh' },
  UNIL:     { name: 'Unilever Ghana',                   domain: 'unileverghana.com' },
}

export function getCompany(symbol) {
  return GSE_COMPANIES[symbol] ?? { name: symbol, domain: null }
}
