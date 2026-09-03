import {SafeAreaView,Pressable,ScrollView,View,Text,TextInput,TouchableOpacity,StyleSheet,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import {  useSafeAreaInsets } from 'react-native-safe-area-context';
import {DateTimePicker } from '@react-native-community/datetimepicker';

export default function ProfileScreen() {

  const MEALS = [
  { name: 'Breakfast', items: 1, calories: 480 },
  { name: 'Lunch', items: 3, calories: 785 },
  { name: 'Dinner', items: 1, calories: 487 },
  { name: 'Morning Snack', items: 0, calories: 0 },
  { name: 'Afternoon Snack', items: 0, calories: 0 },
  { name: 'Evening Snack', items: 0, calories: 0 },
];
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
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
        </View>
        <View style={styles.divider} />
        <View>
            <Text style = {styles.title}>
                Food Log
            </Text>
            <Text style={styles.date}>
            {new Date().toLocaleDateString('en-GB', {weekday: 'long', 
                                                    day: 'numeric', 
                                                    month: 'long', 
                                                    year: 'numeric',})}

            </Text>
    
        <View style={[styles.step, styles.activityBox]}>
            <Text
                  style={styles.activity}
                  onPress={() => router.push('/log/activities')}
                  >
                  Diet Quality Score 
            </Text>
        </View>
{MEALS.map((meal) => (
  <TouchableOpacity
    key={meal.id}
    style={styles.mealRow}
    onPress={() => router.push(`/log/foodintake/${meal.id}`)}
  >
    <View>
      <Text style={styles.mealName}>{meal.name}</Text>
      <Text style={styles.mealItems}>{meal.items} item(s)</Text>
    </View>

    <View style={styles.mealRight}>
      <View style={styles.caloriePill}>
        <Text style={styles.calorieValue}>{meal.calories}</Text>
        <Text style={styles.calorieUnit}>kcal</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
  </TouchableOpacity>
))}
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

mealRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#123B2F',
  borderRadius: 12,
  paddingVertical: 12,
  paddingHorizontal: 16,
  marginHorizontal: 25,
  marginBottom: 10,
},

mealName: { color: '#D4E6DF', fontSize: 13 },
mealItems: { color: '#60766E', fontSize: 10, marginTop: 2 },

mealRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

caloriePill: {
  backgroundColor: '#0E2A20',
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 4,
  alignItems: 'center',
},

calorieValue: { color: '#48DDB0', fontSize: 13, fontWeight: '600' },
calorieUnit: { color: '#3AA889', fontSize: 8 },

chevron: { color: '#60766E', fontSize: 18 },

});