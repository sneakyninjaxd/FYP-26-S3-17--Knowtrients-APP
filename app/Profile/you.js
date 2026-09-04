import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';
const CONDITIONS = [
  'None',
  'Type 1 Diabetes',
  'Type 2 Diabetes',
  'Hypertension',
  'Lactose Intolerant',
  'Other',
];

export default function ProfileScreen() {

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

          <Text style={styles.profileTagline}>
            Know your nutrients, Know your health
          </Text>
        </View>


        {/* Progress bar */}
        <View style={styles.progressRow}>

          <View style={styles.step}>
            <Text style={styles.activeStep}>
              Step 1: You
            </Text>

            <View style={styles.activeLine} />
          </View>

          <View style={styles.step}>
            <Text style={styles.inactiveStep}>
              Step 2: Your Goals
            </Text>

            <View style={styles.inactiveLine} />
          </View>

          <View style={styles.step}>
            <Text style={styles.inactiveStep}>
              Step 3: Your Lifestyle
            </Text>

            <View style={styles.inactiveLine} />
          </View>

        </View>


        {/* TITLE */}
        <Text style={styles.title}>
          Tell us about you
        </Text>

        <Text style={styles.description}>
          This information helps Knowtrients give recommendations
          more accurately
        </Text>


        {/* DATE OF BIRTH */}
        <Text style={styles.label}>
          Date of Birth:
        </Text>

        <View style={styles.dateInput}>

          <TextInput
            style={styles.input}
            placeholder="dd/mm/yyyy"
            placeholderTextColor="#60766E"
          />

          <Text style={styles.icon}>
            □
          </Text>

        </View>


        {/* GENDER */}
        <View style={styles.genderRow}>

          <Text style={styles.label}>
            Gender:
          </Text>

          {['Male', 'Female'].map((option) => {

            const selected = gender === option;

            return (
              <Pressable
                key={option}
                style={styles.radioRow}
                onPress={() => setGender(option)}
              >

                <View
                  style={[
                    styles.circle,
                    selected && styles.circleSelected,
                  ]}
                >
                  {selected && (
                    <View style={styles.dot} />
                  )}
                </View>

                <Text style={styles.genderText}>
                  {option}
                </Text>

              </Pressable>
            );

          })}
        </View>
             {/* COUNTRY */}
        <Text style={styles.label}>
          Country:
        </Text>

        <TouchableOpacity style={styles.countryInput}>

          <Text style={styles.placeholder}>
            Select Country
          </Text>

          <Text style={styles.arrow}>
            ⌄
          </Text>

        </TouchableOpacity>

        <Text style={styles.helperText}>
          Knowing your country allows Knowtrients to recommend local
          dishes to you.
        </Text>


        {/* HEIGHT + WEIGHT */}
        <View style={styles.row}>

          <View style={styles.field}>

            <Text style={styles.label}>
              Height (cm):
            </Text>

            <View style={styles.measureInput}>

              <TextInput
                style={styles.input}
                placeholder="e.g. 170"
                placeholderTextColor="#60766E"
              />

              <Text style={styles.unit}>
                cm
              </Text>

            </View>

          </View>
                    <View style={styles.field}>

            <Text style={styles.label}>
              Weight (kg):
            </Text>

            <View style={styles.measureInput}>

              <TextInput
                style={styles.input}
                placeholder="e.g. 68"
                placeholderTextColor="#60766E"
              />

              <Text style={styles.unit}>
                kg
              </Text>

            </View>

          </View>

        </View>


        {/* MEDICAL CONDITIONS */}
        <Text style={styles.label}>
          Medical Conditions
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


        {/* CONTINUE */}
        <TouchableOpacity style={styles.continueButton}
          onPress={() => router.push('/Profile/goal')}>
          <Text style={styles.continueText}>
            Continue →
          </Text>
        </TouchableOpacity>
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