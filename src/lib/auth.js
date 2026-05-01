const USERS_KEY = "uniride_users";
const CURRENT_USER_KEY = "uniride_current_user";

// Signup
export const signup = (user) => {
  const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];

  const exists = users.find((u) => u.email === user.email);
  if (exists) return false;

  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return true;
};

// Login
export const login = (email, password) => {
  const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];

  const user = users.find(
    (u) => u.email === email && u.password === password
  );

  if (!user) return false;

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  return user;
};

// Get current user
export const getCurrentUser = () => {
  if (typeof window === "undefined") return null;
  return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
};

// Logout
export const logout = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};