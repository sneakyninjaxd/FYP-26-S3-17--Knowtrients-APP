export const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

export const CONDITIONS = [
  { id: 'none', label: 'None' },
  { id: 'type1_diabetes', label: 'Type 1 Diabetes' },
  { id: 'type2_diabetes', label: 'Type 2 Diabetes' },
  { id: 'hypertension', label: 'Hypertension' },
  { id: 'lactose_intolerant', label: 'Lactose Intolerant' },
  { id: 'other', label: 'Other' },
];

export const GOALS = [
  { id: 'lose_weight', label: 'Lose Weight' },
  { id: 'gain_weight', label: 'Gain Weight' },
  { id: 'maintain_weight', label: 'Maintain Weight' },
  { id: 'build_muscle', label: 'Build Muscle' },
  { id: 'improve_health', label: 'Improve Overall Health' },
  { id: 'better_lifestyle', label: 'Better Lifestyle' },
  { id: 'balanced_meals', label: 'Eat More Balanced Meals' },
  { id: 'better_sleep', label: 'Better Sleep Schedule' },
  { id: 'other', label: 'Other' },
];

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', description: 'Mostly sitting' },
  { id: 'lightly_active', label: 'Lightly Active', description: 'Exercise a few times per month' },
  { id: 'moderately_active', label: 'Moderately Active', description: 'Exercise 1-2 days / week' },
  { id: 'very_active', label: 'Very Active', description: 'Exercise almost daily' },
  { id: 'athlete', label: 'Athlete', description: '' },
];

export const DIETARY = [
  { id: 'no_preference', label: 'No Preference' },
  { id: 'halal', label: 'Halal' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'gluten_free', label: 'Gluten Free' },
  { id: 'dairy_free', label: 'Dairy Free' },
  { id: 'low_carb', label: 'Low Carb' },
  { id: 'high_protein', label: 'High Protein' },
  { id: 'seafood_allergy', label: 'Seafood Allergy' },
  { id: 'other', label: 'Other' },
];

export const COUNTRIES = [
  'Singapore',
  'Malaysia',
  'Indonesia',

  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola',
  'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus',
  'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria',
  'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde',
  'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia',
  'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
  'Czech Republic', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador',
  'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany',
  'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau',
  'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland',
  'India', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast',
  'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
  'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon',
  'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
  'Luxembourg', 'Macau', 'Madagascar', 'Malawi', 'Maldives', 'Mali',
  'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
  'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco',
  'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands',
  'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea',
  'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine',
  'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino',
  'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Seychelles', 'Sierra Leone', 'Slovakia', 'Slovenia', 'Solomon Islands',
  'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain',
  'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo',
  'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan',
  'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu',
  'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

export const labelFor = (list, id) =>
  list.find((item) => item.id === id)?.label ?? id;