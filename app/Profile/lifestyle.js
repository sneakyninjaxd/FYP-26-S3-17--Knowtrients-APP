import { router } from 'expo-router';
import { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const CONDITIONS = [
  'No Preference',
  'Halal',
  'Vegan',
  'Vegetarian',
  'Gluten Free',
  'Dairy Free',
  'Low Crab',
  'High Protein',
  'Seafood allergy',
  'Other',
];

  export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [activityLevel, setActivityLevel] = useState('');
  const [gender, setGender] = useState('');
  const [conditions, setConditions] = useState([]);
  const [otherCondition, setOtherCondition] = useState('');

  const toggleCondition = (item) => {
    setConditions((prev) => {
      if (item === 'None') return prev.includes('None') ? [] : ['None'];

      return prev.includes(item)
        ? prev.filter((c) => c !== item)
        : [...prev.filter((c) => c !== 'None'), item];
    });
  };
    return (

        <SafeAreaView style={styles.container}>
        
              <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                {/* Logo */}
                <View
                  style={[
                    styles.logoContainer,
                    styles.profileLogoContainer
                  ]}
                >
                  <Text
                    style={[
                      styles.logo,
                      styles.profileLogo
                    ]}
                  >
                    ✦ Knowtrients
                  </Text>
        
                  <Text style={styles.profileTagline}>
                    Know your nutrients, Know your health
                  </Text>
                </View>


                {/* Progress bar */}
                <View style={styles.progressRow}>
        
                  <View style={styles.step}>
                    <Text style={styles.inactiveStep}>
                      Step 1: Your
                    </Text>
        
                    <View style={styles.inactiveLine} />
                  </View>
        
                  <View style={styles.step}>
                    <Text style={styles.inactiveStep}>
                      Step 2: Your Goals
                    </Text>
        
                    <View style={styles.inactiveLine} />
                  </View>
        
                  <View style={styles.step}>
                    <Text style={styles.activeStep}>
                      Step 3: Your Lifestyle
                    </Text>
                    <View style={styles.activeLine} />
                  </View>
                </View>
                        <Text style={styles.title}>
                          Let us know about your Lifestyle
                        </Text>
                        <Text style={styles.description}>
                          Let Knowtrients understand you better to give you recommendations that fits your lifestyle
                        </Text>
                                {/* Activity levels*/}
                                <Text style={styles.label}>
                                  Activity Level
                                </Text>
                                  <Text style = {styles.description}>
                                    How active are you? Select one.
                                  </Text>

                                  <View style={styles.activityContainer}>

                                    {/* Sedentary */}
                                            <TouchableOpacity
                                                style={
                                                        activityLevel === 'Sedentary'
                                                        ? styles.selectedActivity
                                                        : styles.activityButton
                                                        }
                                                        onPress={() => setActivityLevel('Sedentary')}
                                                        >
                                                    <Text style={styles.activityTitle}>
                                                        Sedentary
                                                    </Text>

                                                    <Text style={styles.activityDescription}>
                                                        Mostly sitting
                                                    </Text>
                                            </TouchableOpacity>


                                    {/* Lightly Active */}
                                            <TouchableOpacity
                                                style={
                                                        activityLevel === 'Lightly Active'
                                                        ? styles.selectedActivity
                                                        : styles.activityButton
                                                        }
                                                        onPress={() => setActivityLevel('Lightly Active')}
                                                        >
                                                    <Text style={styles.activityTitle}>
                                                        Lightly Active
                                                    </Text>

                                                    <Text style={styles.activityDescription}>
                                                            Exercise a few times per month
                                                    </Text>
                                            </TouchableOpacity>


                                    {/* Moderately Active */}
                                            <TouchableOpacity
                                                style={
                                                        activityLevel === 'Moderately Active'
                                                        ? styles.selectedActivity
                                                        : styles.activityButton
                                                        }
                                                        onPress={() => setActivityLevel('Moderately Active')}
                                                        >
                                                    <Text style={styles.activityTitle}>
                                                        Moderately Active
                                                    </Text>

                                                    <Text style={styles.activityDescription}>
                                                        Exercise 1-2 days / week
                                                    </Text>
                                            </TouchableOpacity>


                                    {/* Very Active */}
                                            <TouchableOpacity
                                                style={
                                                        activityLevel === 'Very Active'
                                                        ? styles.selectedActivity
                                                        : styles.activityButton
                                                        }
                                                        onPress={() => setActivityLevel('Very Active')}
                                                        >
                                                    <Text style={styles.activityTitle}>
                                                        Very Active
                                                    </Text>

                                                    <Text style={styles.activityDescription}>
                                                        Exercise almost daily
                                                    </Text>
                                            </TouchableOpacity>


                                    {/* Athlete */}
                                            <TouchableOpacity
                                                style={
                                                        activityLevel === 'Athlete'
                                                        ? styles.selectedActivity
                                                        : styles.activityButton
                                                        }
                                                        onPress={() => setActivityLevel('Athlete')}
                                                        >
                                                    <Text style={styles.activityTitle}>
                                                        Athlete
                                                    </Text>
                                            </TouchableOpacity>

                                </View>
                                <Text style={styles.label}>
                                  Dietary Preference
                                </Text>
                                  <Text style = {styles.description}>
                                    Select all that apply.This allows Knowtrients to give recommendations according to your diet
                                  </Text>                                                                
                                <View style={styles.conditionContainer}>
                                  {CONDITIONS.map((item) => {
                                    const selected = conditions.includes(item);
                        
                                  return (
                                  <TouchableOpacity
                                      key={item}
                                      onPress={() => toggleCondition(item)}
                                      style={selected ? styles.selectedCondition : styles.conditionButton}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: selected }}
                                      >
                                      <Text style={selected ? styles.selectedText : styles.conditionText}>
                                        {item}
                                      </Text>
                                  </TouchableOpacity>
                                  );
                                  })}
                                </View>
                                  {/* OTHER CONDITION */}
                                  {conditions.includes('Other') && (
                                  <TextInput
                                    style={styles.conditionInput}
                                    placeholder="Describe your condition(s)..."
                                    placeholderTextColor="#60766E"
                                    value={otherCondition}
                                    onChangeText={setOtherCondition}
                                    />
                                    )}

                            {/* Back */}
                            <View style = {styles.row}>
                              <TouchableOpacity style={styles.continueButton}
                              onPress={() => router.push('/Profile/you')}>
                              <Text style={styles.continueText}>
                                ←Back
                              </Text>
                            {/* CONTINUE */}
                            </TouchableOpacity>
                              <TouchableOpacity style={styles.continueButton}
                                onPress={() => router.push('/Profile/finish')}>
                              <Text style={styles.continueText}>
                                Continue →
                              </Text>
                            </TouchableOpacity>
                            </View>
              </ScrollView>
        </SafeAreaView>
    )
}
const styles = StyleSheet.create({
  profileLogoContainer: {
    alignItems: 'flex-start',
    paddingLeft: 25,
  },

  profileLogo: {
    fontSize: 20,
  },

  profileTagline: {
    color: '#fff',
    fontSize: 12,
    marginTop: 3,
  },

    progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 30,
  },

  step: {
    flex: 1,
  },

  activeStep: {
    color: '#48DDB0',
    fontSize: 10,
    marginBottom: 5,
  },

  inactiveStep: {
    color: '#17644E',
    fontSize: 10,
    marginBottom: 5,
  },

  activeLine: {
    height: 3,
    backgroundColor: '#48DDB0',
    borderRadius: 5,
  },

  inactiveLine: {
    height: 3,
    backgroundColor: '#123B2F',
    borderRadius: 5,
  },


    title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: 'serif',
    fontWeight: 'bold',
    marginBottom: 5,
  },

  description: {
    color: '#3AA889',
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 20,
  },


    dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10251E',
    width: 135,
    height: 38,
    borderRadius: 7,
    paddingHorizontal: 10,
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    padding: 0,
  },

  icon: {
    color: '#A5DCCC',
    fontSize: 18,
  },

  label: {
    color: '#D4E6DF',
    fontSize: 12,
    marginBottom: 7,
    marginTop: 12,
  },

genderRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 10,
},

radioRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginLeft: 15,
},

circle: {
  width: 12,
  height: 12,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: '#FFFFFF',
  justifyContent: 'center',
  alignItems: 'center',
},

circleSelected: {
  borderColor: '#48DDB0',
},

dot: {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: '#48DDB0',
},

genderText: {
  color: '#D4E6DF',
  fontSize: 12,
  marginLeft: 5,
},
  countryInput: {
    width: 165,
    height: 38,
    backgroundColor: '#10251E',
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },

  placeholder: {
    color: '#60766E',
    fontSize: 12,
  },

  arrow: {
    color: '#48DDB0',
    fontSize: 18,
  },

  helperText: {
    color: '#60766E',
    fontSize: 9,
    marginTop: 7,
  },

  row: {
    flexDirection: 'row',
    gap: 20,
  },

  field: {
    flex: 1,
  },

  measureInput: {
    height: 38,
    backgroundColor: '#10251E',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  unit: {
    color: '#48DDB0',
    fontSize: 11,
    fontWeight: 'bold',
  },

  conditionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  conditionButton: {
    backgroundColor: '#102A21',
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 20,
  },

  selectedCondition: {
    backgroundColor: '#102A21',
    borderWidth: 1,
    borderColor: '#48DDB0',
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 20,
  },

  conditionText: {
    color: '#60766E',
    fontSize: 11,
  },

  selectedText: {
    color: '#48DDB0',
    fontSize: 11,
  },

  conditionInput: {
    height: 42,
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    color: '#FFFFFF',
  },

  conditionHelper: {
    color: '#60766E',
    fontSize: 9,
    marginTop: 7,
  },

  continueButton: {
    backgroundColor: '#48DDB0',
    width: 143,
    height: 42,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 45,
  },

  continueText: {
    color: '#00382B',
    fontSize: 14,
    fontWeight: '600',
  },


  activityContainer: {
  gap: 8,
  marginTop: 5,
},

activityButton: {
  backgroundColor: '#07140F',
  borderWidth: 1,
  borderColor: '#123B2F',
  borderRadius: 12,
  minHeight: 35,
  paddingVertical: 6,
  paddingHorizontal: 15,
},

selectedActivity: {
  backgroundColor: '#07140F',
  borderWidth: 1,
  borderColor: '#48DDB0',
  borderRadius: 12,
  minHeight: 35,
  paddingVertical: 6,
  paddingHorizontal: 15,
},

activityTitle: {
  color: '#48DDB0',
  fontSize: 12,
  fontWeight: '500',
},

activityDescription: {
  color: '#60766E',
  fontSize: 10,
  marginTop: 2,
},
  container: {
    flex: 1,
    backgroundColor: '#020D09',
  },

  logoContainer: {
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'serif',
  },
});