import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    SafeAreaView,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
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
                Account Details
            </Text>
            <Text style = {styles.description}>
                Update your account details & settings 
            </Text>
        <View style={styles.Card}>
                <Text style={styles.label}>Email</Text>
        
                <TextInput
                  style={styles.input}
                  placeholder="example123@gmail.com"
                  placeholderTextColor="#bd4d4d"
                />
                {/* First Name and Last Name placed in a row with flexbox*/}
                <View style={styles.row}>
        
                  <View style={styles.field}>
                    <Text style={styles.label}>First Name:</Text>
        
                    <TextInput
                      style={styles.input}
                      placeholder="John"
                      placeholderTextColor="#bd4d4d"
                    />
                  </View>
        
                  <View style={styles.field}>
                    <Text style={styles.label}>Last Name:</Text>
        
                    <TextInput
                      style={styles.input}
                      placeholder="Doe"
                      placeholderTextColor="#bd4d4d"
                    />
                  </View>
        
                </View>
                {/* password with secure text*/}
                <Text style={styles.label}>Current Password:</Text>
        
                <TextInput
                  secureTextEntry
                  style={styles.input}
                  placeholder="**************"
                  placeholderTextColor="#bd4d4d"
                />
        
                <Text style={styles.label}>Change Password:</Text>
        
                <TextInput
                  secureTextEntry
                  style={styles.input}
                  placeholder="**************"
                  placeholderTextColor="#bd4d4d"
                /> 

                <Text style={styles.label}>Re-type New Password:</Text>
        
                <TextInput
                  secureTextEntry
                  style={styles.input}
                  placeholder="**************"
                  placeholderTextColor="#bd4d4d"
                /> 



                      {/* Savge button*/}
                        <TouchableOpacity style={styles.button}
                        onPress={() => router.push('/account/account')}>
                          <Text style={styles.buttonText}>
                            Save
                          </Text>
                        </TouchableOpacity>
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
  height: '0.1%',
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

  logobelow: {
    color: '#ddd',
    fontSize: 12,
  },

  Card: {
    flex: 1,
    backgroundColor: '#0B2119',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 45,
  },

  label: {
    color: '#fff',
    marginBottom: 5,
  },

  input: {
    backgroundColor: '#00100B',
    color: '#fff',
    padding: 12,
    borderRadius: 5,
    marginBottom: 12,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  field: {
    flex: 1,
  },

  button: {
    backgroundColor: '#48DDB0',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
    width: 130,
    alignSelf: 'center',
  },

  buttonText: {
    color: '#00382B',
    fontSize: 14,
  },

  login: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 70,
    fontSize: 12,
  },

   title:{
    color:'#fff',
    fontSize:30,
    textAlign:'center',
    fontFamily:'serif',
    margintop: 40,
  },

  description:{
    color:'#ccc',
    textAlign:'center',
    marginBottom:25,
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
  }
});