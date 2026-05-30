import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView 
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { authApi } from '../services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    setErrorMsg('');

    // Basic Validations
    if (!email || !password) {
      setErrorMsg('Please fill in all fields');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.login(email.trim(), password);
      
      const { accessToken, user } = response.data;
      
      if (!user.isAdmin) {
        setErrorMsg('Access denied: Admin permissions required');
        setIsLoading(false);
        return;
      }

      // Store JWT in SecureStore
      await SecureStore.setItemAsync('admin_token', accessToken);
      
      // Navigate to home
      router.replace('/');
    } catch (err: any) {
      console.error('Login error:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Invalid credentials or connection failure';
      setErrorMsg(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <Text style={styles.brandText}>RAJSHREE JEWELS</Text>
            <Text style={styles.titleText}>Admin Portal</Text>
            <Text style={styles.subtitleText}>Sign in to manage inventory & list new jewellery pieces</Text>
          </View>

          <View style={styles.formContainer}>
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@rajshreejewels.com"
              placeholderTextColor="#9a8f7e"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isLoading}
            />

            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9a8f7e"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!isLoading}
            />

            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <Text style={styles.buttonText}>Access Panel →</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a', // Rich dark luxurious background
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#C9A84C', // Gold brand highlight
    letterSpacing: 4,
    textAlign: 'center',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8C97A',
    letterSpacing: 2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  subtitleText: {
    fontSize: 13,
    color: '#a09689',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  formContainer: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#3a3325',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  errorBox: {
    backgroundColor: '#522222',
    borderWidth: 1,
    borderColor: '#b91c1c',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 12,
    color: '#E8C97A',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#423c30',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#C9A84C',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#7a642e',
  },
  buttonText: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
