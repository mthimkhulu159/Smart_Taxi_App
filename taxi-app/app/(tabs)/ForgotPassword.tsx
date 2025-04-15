import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchData } from "../api/api"; // Adjust path if needed
import { apiUrl } from "../api/apiUrl"; // Adjust path if needed
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// --- Color Palette ---
const colors = {
  primary: "#6C63FF",
  secondary: "#F0F2F5",
  backgroundGradientStart: "#7F78FF",
  backgroundGradientEnd: "#6C63FF",
  text: "#333",
  textLight: "#FFF",
  placeholder: "#A0A0A0",
  white: "#FFFFFF",
  error: "#E53E3E",
};

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"email" | "token" | "password">("email");

  // Step 1: Request password reset token
  const handleForgotPasswordSubmit = async () => {
    if (!email) {
      Alert.alert("Missing Information", "Please enter your email.");
      return;
    }
    setIsLoading(true);
    const endpoint = "auth/forgot-password";
    const body = { email };

    try {
      const response = await fetchData(apiUrl, endpoint, { method: "POST", body });
      if (response?.message) {
        Alert.alert("Success", response.message);
        setStep("token");
      } else {
        throw new Error(response?.message || "Error sending reset token.");
      }
    } catch (error: any) {
      console.error("Forgot Password Error:", error);
      Alert.alert("Error", error?.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify the token entered by the user
  const handleVerifyToken = async () => {
    if (!token) {
      Alert.alert("Missing Information", "Please enter the reset token.");
      return;
    }
    setIsLoading(true);
    const endpoint = "auth/verify-token";
    const body = { email, token };

    try {
      const response = await fetchData(apiUrl, endpoint, { method: "POST", body });
      if (response?.message) {
        Alert.alert("Success", response.message);
        setStep("password");
      } else {
        throw new Error(response?.message || "Invalid or expired token.");
      }
    } catch (error: any) {
      console.error("Token Verification Error:", error);
      Alert.alert("Error", error?.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset the password
  const handleResetPassword = async () => {
    if (!newPassword ) {
      Alert.alert("Missing Information", "Please enter your new password and confirm it.");
      return;
    }
    setIsLoading(true);
    const endpoint = "auth/reset-password";
    const body = { email, newPassword, token };

    try {
      const response = await fetchData(apiUrl, endpoint, { method: "POST", body });
      if (response?.message) {
        Alert.alert("Success", response.message);
        // Optionally redirect the user to the login screen after password reset
      } else {
        throw new Error(response?.message || "Failed to reset password.");
      }
    } catch (error: any) {
      console.error("Password Reset Error:", error);
      Alert.alert("Error", error?.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => {
    if (step === "email") {
      return (
        <>
          <View style={styles.inputContainer}>
            <Feather name="mail" size={20} color={colors.placeholder} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleForgotPasswordSubmit}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (step === "token") {
      return (
        <>
          <View style={styles.inputContainer}>
            <Feather name="key" size={20} color={colors.placeholder} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter 6-Digit Token"
              placeholderTextColor={colors.placeholder}
              value={token}
              onChangeText={setToken}
              keyboardType="numeric"
              maxLength={6}
            />
          </View>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleVerifyToken}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Verify Token</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (step === "password") {
      return (
        <>
          <View style={styles.inputContainer}>
            <Feather name="lock" size={20} color={colors.placeholder} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="New Password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
          </View>  
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Reset Password</Text>
          </TouchableOpacity>
        </>
      );
    }
  };

  return (
    <LinearGradient
      colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authContainer}>
            {renderForm()}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 10,
  },
  authContainer: {
    backgroundColor: colors.white,
    width: "90%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    marginVertical: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderRadius: 12,
    marginBottom: 15,
    width: "100%",
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 55,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    paddingVertical: 16,
    width: "100%",
    borderRadius: 12,
    marginTop: 15,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
});

export default ForgotPassword;
