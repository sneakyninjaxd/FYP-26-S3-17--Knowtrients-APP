import { createContext, useContext, useState } from 'react';

const ProfileContext = createContext(null);

const EMPTY_PROFILE = {
  firstName: '',
  lastName: '',
  dateOfBirth: null,        // '2000-10-10'
  gender: null,             // 'male' | 'female'
  country: null,            // 'SG'
  heightCm: null,           // number
  weightKg: null,           // number
  conditions: [],           // ['type1_diabetes']
  otherCondition: '',

  goals: [],                // ['gain_weight']
  otherGoal: '',
  timeline: null,           // '1_month'
  currentWeightKg: null,
  targetWeightKg: null,

  activityLevel: null,      // 'sedentary'
  dietaryPreferences: [],   // ['halal']
  otherDietary: '',
};

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);

  // merge a partial update — each form saves only its own fields
  const updateProfile = (changes) => {
    setProfile((prev) => ({ ...prev, ...changes }));
  };

  return (
    <ProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);