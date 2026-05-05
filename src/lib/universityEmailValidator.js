// Only accepted Bahrain university domains.
// Subdomains are accepted automatically (e.g. std.org.aou.bh).
const ALLOWED_UNIVERSITY_DOMAINS = [
  "uob.edu.bh",
  "polytechnic.bh",
  "std.aou.org.bh",
  "std.org.aou.bh",
  "aou.org.bh",
  "students.ahlia.edu.bh",
  "asu.edu.bh",
  "utb.edu.bh",
  "ruw.edu.bh",
  "bibf.com.bh",
  "ucb.edu.bh",
  "eub.edu.bh",
  "ku.edu.bh",
];

export const isValidUniversityEmail = (email) => {
  if (!email || typeof email !== "string") return false;

  const domain = email.toLowerCase().trim().split("@")[1];
  if (!domain) return false;

  return ALLOWED_UNIVERSITY_DOMAINS.some(
    (allowedDomain) => domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
  );
};

export const extractUniversityDomain = (email) => {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1] : null;
};
