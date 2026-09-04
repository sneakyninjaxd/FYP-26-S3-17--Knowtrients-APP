import { router } from 'expo-router';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
export default function CreateAccount() {
  return (
    <View style={styles.container}>

      {/*Logo and tagline*/}
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>✦ Knowtrients</Text>
        <Text style={styles.logobelow}>
          Know your nutrients, Know your health
        </Text>
      </View>
      {/* Card so all the input are inside*/}
      <View style={styles.Card}>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.description}>
          Enter your details to continue
        </Text>

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
        <Text style={styles.label}>Password:</Text>

        <TextInput
          secureTextEntry
          style={styles.input}
          placeholder="**************"
          placeholderTextColor="#bd4d4d"
        />

        <Text style={styles.label}>Retype Password:</Text>

        <TextInput
          secureTextEntry
          style={styles.input}
          placeholder="**************"
          placeholderTextColor="#bd4d4d"
        />
      {/* Create Account button*/}
        <TouchableOpacity style={styles.button}
        onPress={() => router.push('/login')}>
          <Text style={styles.buttonText}>
            Create Account
          </Text>
        </TouchableOpacity>
        {/* Login */}
        <Text style={styles.login}>
          Have an account?{" "}
          <Text
            style={{ color: '#48DDB0' }}
            onPress={() => router.push('/login')}
          >
            Login!
          </Text>
        </Text>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

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

