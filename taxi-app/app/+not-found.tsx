import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation'; // Adjust path if needed

// ✅ Navigation type: We want to navigate to 'Home'
type NavigationProp = StackNavigationProp<RootStackParamList>;

const NotFoundScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleGoHome = () => {
    // Navigate to 'Home' without passing any params
    navigation.navigate('Home'); // No need for {} when no params are required
  };

  return (
    <View style={styles.container}>
      <Image
       // source={require('../assets/404.png')} // Replace with your 404 image path
        style={styles.image}
        resizeMode="contain"
      />
      <Text style={styles.title}>Oops! Page not found.</Text>
      <Text style={styles.message}>
        The screen you're looking for doesn’t exist or has been moved.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleGoHome}>
        <Text style={styles.buttonText}>Go to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

export default NotFoundScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  image: {
    width: 250,
    height: 250,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
