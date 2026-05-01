export function validateUniversityEmail(email, domains) {
  if (!email || !domains || domains.length === 0) return false;

  const emailDomain = email.split("@")[1];

  return domains.includes(emailDomain);
}