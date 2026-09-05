import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function ProfileScreen() {
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
                My Activities
            </Text>
            <Text style={styles.date}>
            {new Date().toLocaleDateString('en-GB', {weekday: 'long', 
                                                    day: 'numeric', 
                                                    month: 'long', })}
            </Text>
    
        <View style={[styles.step, styles.activityBox]}>
            <Text
                  style={styles.activity}
                  onPress={() => router.push('/log/activities/activities')}
                  >
                  My Activities
            </Text>
        </View>

        <View style={[styles.step, styles.activityBox]}>
            <Text
                  style={styles.activity}
                  onPress={() => router.push('/log/sleep')}
                  >
                  My Sleep
            </Text>
        </View>

        <View style={[styles.step, styles.activityBox]}>
            <Text
                  style={styles.activity}
                  onPress={() => router.push('/log/foodintake')}
                  >
                  My Food intake
            </Text>
        </View>

        
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

});