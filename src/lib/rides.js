const STORAGE_KEY = "uniride_rides";

// Get all rides
export const getRides = () => {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
};

// Save a new ride
export const addRide = (ride) => {
  const rides = getRides();
  rides.push(ride);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rides));
};