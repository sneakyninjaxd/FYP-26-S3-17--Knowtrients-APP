import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
const PLANS = [
  {
    id: 'free',
    name: 'Free Plan',
    price: null,
    features: [
      '1 recommendation per day',
      'Technical explanations only',
      'View progress history for the last 7 days',
      'View regular progress charts',
      'Manual sleep input',
    ],
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    price: '$10/month',
    features: [
      'Unlimited recommendations',
      'Toggle between technical and plain-language explanations',
      'View full progress history',
      'View advanced progress charts',
      'Automatic sleep tracking',
      'Generate formatted health report',
    ],
  },
];
export default function Subscription() {
 // State to track the current plan
  const [currentPlan, setCurrentPlan] = useState('free'); // Default to Premium Plan
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Logo */}
        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>

          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
        <View>
            <Text style = {styles.title}>
                Subscription
            </Text>
            <Text style = {styles.description}>
                Choose your plan 
            </Text>
            // checks if the current plan is premium or free and displays the appropriate message
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id;

              return (
                <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCardActive]}>
                  // If the plan is the current plan, display a badge
                  {isCurrent && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Current</Text>
                    </View>
                  )}

                  <Text style={styles.planName}>{plan.name}</Text>

                  {plan.features.map((f) => (
                    <Text key={f} style={styles.feature}>• {f}</Text>
                  ))}

                  {plan.price && (
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{plan.price}</Text>
                      <TouchableOpacity style={styles.planButton}
                      onPress={() => setCurrentPlan(isCurrent ? 'free' : 'premium')}>
                        <Text style={styles.planButtonText}>
                          {isCurrent ? 'Cancel Subscription' : 'Get Premium'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}

      </View>
    </ScrollView>
    </SafeAreaView>

  );
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
  fontSize: 35,
  fontFamily: 'serif',
  marginBottom: 5,
  paddingLeft: 25,
  paddingTop: 10,
},

  description: {
    color: '#3AA889',
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 20,
    paddingLeft: 25,
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

  divider: {
  backgroundColor: '#123B2F',
  height: '1%',
},

date: {
  color: '#48DDB0',
  fontSize: 12,
  paddingLeft: 25,
  marginTop: 20,
  marginBottom: 6,
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

activityBox: {
  borderWidth: 1,
  borderColor: '#123B2F',
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 18,
  marginHorizontal: 25,
  marginBottom: 12,
},

activity: {
  color: '#3AA889',
  fontSize: 13,
},

header: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 25,
  paddingVertical: 20,
},

activityBox2: {
  borderWidth: 1,
  borderColor: '#921d1d',
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 18,
  marginHorizontal: 25,
  marginBottom: 12,
},

activity2: {
  color: '#921d1d',
  fontSize: 13,
},

activityBox3: {
  borderWidth: 1,
  backgroundColor: '#ce3535',
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 18,
  marginHorizontal: 25,
  marginTop: 80,

},

activity3: {
  color: '#faf7f7',
  fontSize: 13,
},

planCard: {
  borderWidth: 1,
  borderColor: '#123B2F',
  borderRadius: 16,
  padding: 20,
  marginHorizontal: 25,
  marginBottom: 16,
},

planCardActive: {
  borderColor: '#48DDB0',
},

badge: {
  position: 'absolute',
  top: 0,
  right: 0,
  backgroundColor: '#48DDB0',
  borderTopRightRadius: 16,
  borderBottomLeftRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 4,
},

badgeText: {
  color: '#00382B',
  fontSize: 10,
  fontWeight: '600',
},

planName: {
  color: '#fff',
  fontSize: 18,
  fontFamily: 'serif',
  marginBottom: 12,
},

feature: {
  color: '#D4E6DF',
  fontSize: 12,
  lineHeight: 20,
},

priceRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 20,
},

price: {
  color: '#48DDB0',
  fontSize: 22,
  fontWeight: '600',
},

planButton: {
  backgroundColor: '#102A21',
  borderRadius: 8,
  paddingHorizontal: 16,
  paddingVertical: 10,
},

planButtonText: {
  color: '#fff',
  fontSize: 12,
  textAlign: 'center',
},
});