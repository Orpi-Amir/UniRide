// List of allowed university email domains
const ALLOWED_UNIVERSITY_DOMAINS = [
  // Generic patterns
  /\.edu$/,
  /\.edu\.bh$/,
  /\.ac\.uk$/,
  /\.ac\.in$/,
  
  // Specific universities (add as needed)
  /aou\.edu\.bh$/,           // Arab Open University
  /buh\.edu\.bh$/,           // University of Bahrain
  /paaet\.edu\.kw$/,         // PAAET Kuwait
  /ksu\.edu\.sa$/,           // King Saud University
  /aku\.ac\.ae$/,            // American University of Khalifa
];

export const isValidUniversityEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return false;
  
  return ALLOWED_UNIVERSITY_DOMAINS.some(pattern => pattern.test(domain));
};

export const extractUniversityDomain = (email) => {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1] : null;
};