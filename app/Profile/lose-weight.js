import { router } from 'expo-router';
import { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';

  export default function ProfileScreen() {
    const [currentWeight, setCurrentWeight] = useState('');
    const [targetWeight, setTargetWeight] = useState('');

    const totalWeightLoss =
    targetWeight !== ''
    ? Number(currentWeight) - Number(targetWeight)
    : 0;
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
                    <Text style={styles.inactiveStep}>
                      Step 1: Your
                    </Text>
        
                    <View style={styles.inactiveLine} />
                  </View>
        
                  <View style={styles.step}>
                    <Text style={styles.activeStep}>
                      Step 2: Your Goals
                    </Text>
        
                    <View style={styles.activeLine} />
                  </View>
        
                  <View style={styles.step}>
                    <Text style={styles.inactiveStep}>
                      Step 3: Your Lifestyle
                    </Text>
                    <View style={styles.inactiveLine} />
                  </View>
                </View>
                        <Text style={styles.title}>
                          Tell us about your 
                          Health Goals
                        </Text>
                        <Text style={styles.description}>
                          Let us know what you would like to achieve so that we can guide you better
                        </Text>
                    {/* Weight Goal */}
                        <Text style={styles.label}>
                            Since you chose to lose Weight...
                        </Text>

                        <Text style={styles.description}>
                            What is your target weight?
                        </Text>

                        <View style={styles.weightTimeline}>
                            {/* Current Weight */}
                            <View style={styles.weightBox}>
                                <Text style={styles.weightLabel}>
                                    Current Weight
                                </Text>

                            <View style={styles.measureInput}>
                                <TextInput
                                    style={styles.input}
                                    placeholderTextColor="#60766E"
                                    keyboardType="numeric"
                                    value={currentWeight}
                                    onChangeText={setCurrentWeight}
                                    />

                                <Text style={styles.unit}>
                                    kg
                                </Text>
                            </View>
                            </View>


                            {/* Target Weight */}
                        <View style={styles.weightBox}>
                        {/* Arrow */}
                                <Text style={styles.weightArrow}>
                                    ↓
                                </Text>
                                    <Text style={styles.weightLabel}>
                                        Target Weight
                                    </Text>

                            <View style={styles.measureInput}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 68"
                                    placeholderTextColor="#60766E"
                                    keyboardType="numeric"
                                    value={targetWeight}
                                    onChangeText={setTargetWeight}
                                    />

                                <Text style={styles.unit}>
                                    kg
                                </Text>
                            </View>
                        </View>


                        {/* Total Weight Gain */}
                        <View style={styles.totalWeightBox}>
                                <Text style={styles.totalWeightLabel}>
                                    Total Weight Loss
                                </Text>

                                <Text style={styles.totalWeightValue}>
                                    {currentWeight !== '' && targetWeight !== ''? `${totalWeightLoss} kg`: '—'}
                                </Text>
                        </View>
                        </View>

                        {/* Back */}
                            <View style = {styles.row}>
                              <TouchableOpacity style={styles.continueButton}
                              onPress={() => router.push('/Profile/goal')}>
                              <Text style={styles.continueText}>
                                ←Back
                              </Text>
                            {/* CONTINUE */}
                            </TouchableOpacity>
                              <TouchableOpacity style={styles.continueButton}
                              onPress={() => router.push('/Profile/lifestyle')}>
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

  label: {
    color: '#D4E6DF',
    fontSize: 12,
    marginBottom: 7,
    marginTop: 12,
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    padding: 0,
  },

  row: {
    flexDirection: 'row',
    gap: 20,
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

  weightTimeline: {
    alignItems: 'center',
    marginTop: 10,
  },

  weightBox: {
    alignItems: 'center',
    width: '100%',
  },

  weightLabel: {
    color: '#D4E6DF',
    fontSize: 12,
    marginBottom: 7,
  },

  weightArrow: {
    color: '#48DDB0',
    fontSize: 28,
    marginVertical: 8,
  },

  totalWeightBox: {
    alignItems: 'center',
    marginTop: 5,
  },

  totalWeightLabel: {
    color: '#D4E6DF',
    fontSize: 12,
    marginBottom: 5,
  },

  totalWeightValue: {
    color: '#48DDB0',
    fontSize: 22,
    fontWeight: 'bold',
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