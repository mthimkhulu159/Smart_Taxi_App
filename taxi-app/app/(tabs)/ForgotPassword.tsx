import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions,
    Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchData } from "../api/api"; // Adjust path if needed
import { apiUrl } from "../api/apiUrl"; // Adjust path if needed
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../types/navigation"; // Adjust path as needed

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
    success: "#28A745",
    background: '#29335C', // Added background color for ErrorPopup consistency
    primaryAccent: '#007AFF', // Added primaryAccent for ErrorPopup consistency
    buttonText: '#FFFFFF', // Added buttonText for ErrorPopup consistency
};

// --- Custom Error Popup Component ---
interface ErrorPopupProps {
    visible: boolean;
    message: string;
    onClose: () => void;
    colors: typeof colors;
}
const ErrorPopup: React.FC<ErrorPopupProps> = ({ visible, message, onClose, colors }) => {
    if (!visible) return null;
    return (
        <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={popupStyles.centeredView}>
                <View style={[popupStyles.modalView, { backgroundColor: colors.background }]}>
                    <Feather name="alert-circle" size={30} color={colors.error} style={popupStyles.errorIcon} />
                    <Text style={[popupStyles.modalTitle, { color: colors.textLight }]}>Error</Text>
                    <Text style={[popupStyles.modalText, { color: colors.textLight }]}>{message}</Text>
                    <TouchableOpacity style={[popupStyles.button, { backgroundColor: colors.primaryAccent }]} onPress={onClose}>
                        <Text style={[popupStyles.buttonText, { color: colors.buttonText }]}>OK</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};
const popupStyles = StyleSheet.create({
    centeredView: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: 'rgba(0, 0, 0, 0.6)' },
    modalView: { margin: 20, borderRadius: 15, padding: 25, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, width: '80%', maxWidth: 350 },
    errorIcon: { marginBottom: 15 },
    modalTitle: { marginBottom: 5, textAlign: "center", fontSize: 18, fontWeight: '600' },
    modalText: { marginBottom: 20, textAlign: "center", fontSize: 16, lineHeight: 22 },
    button: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 30, elevation: 2, minWidth: 100, alignItems: 'center' },
    buttonText: { fontSize: 16, fontWeight: "bold", letterSpacing: 0.5 }
});
// --- End of ErrorPopup Component ---

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [token, setToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<"email" | "token" | "password">("email");
    const [message, setMessage] = useState<string | null>(null);
    const [isErrorPopupVisible, setIsErrorPopupVisible] = useState(false);
    const [popupErrorMessage, setPopupErrorMessage] = useState<string>('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

    const showError = (message: string) => {
        setPopupErrorMessage(message);
        setIsErrorPopupVisible(true);
    };

    const clearMessages = () => {
        setMessage(null);
        setIsErrorPopupVisible(false);
        setPopupErrorMessage('');
    };

    // Step 1: Request password reset token
    const handleForgotPasswordSubmit = async () => {
        clearMessages();
        if (!email) {
            showError("Please enter your email.");
            return;
        }
        setIsLoading(true);
        const endpoint = "auth/forgot-password";
        const body = { email };

        try {
            const response = await fetchData(apiUrl, endpoint, { method: "POST", body });
            if (response?.message) {
                setMessage(response.message);
                setStep("token");
            } else {
                throw new Error(response?.message || "Error sending reset token.");
            }
        } catch (error: any) {
            console.error("Forgot Password Error:", error);
            // **CHECK FOR BACKEND ERROR MESSAGE**
            if (error?.response?.data?.message === "User not found.") {
                showError("User not found.");
            } else {
                showError(error?.message || "An error occurred.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verify the token entered by the user
    const handleVerifyToken = async () => {
        clearMessages();
        if (!token) {
            showError("Please enter the reset token.");
            return;
        }
        setIsLoading(true);
        const endpoint = "auth/verify-token";
        const body = { email, token };

        try {
            const response = await fetchData(apiUrl, endpoint, { method: "POST", body });
            if (response?.message) {
                setMessage(response.message);
                setStep("password");
            } else {
                throw new Error(response?.message || "Invalid or expired token.");
            }
        } catch (error: any) {
            console.error("Token Verification Error:", error);
            showError(error?.message || "An error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    // Step 3: Reset the password
    const handleResetPassword = async () => {
        clearMessages();
        if (!newPassword || !confirmPassword) {
            showError("Please enter your new password and confirm it.");
            return;
        }
        if (newPassword !== confirmPassword) {
            showError("Passwords do not match.");
            return;
        }
        setIsLoading(true);
        const endpoint = "auth/reset-password";
        const body = { email, newPassword, token };

        try {
            const response = await fetchData(apiUrl, endpoint, { method: "POST", body });
            if (response?.message) {
                setMessage("Password reset successfully. You can now log in with your new password.");
                // Optionally redirect the user to the login screen after password reset
                setTimeout(() => {
                    navigation.navigate("Auth"); // Assuming 'Auth' is the name of your AuthScreen route
                }, 2000);
            } else {
                throw new Error(response?.message || "Failed to reset password.");
            }
        } catch (error: any) {
            console.error("Password Reset Error:", error);
            showError(error?.message || "An error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const goToPreviousStep = () => {
        clearMessages();
        if (step === "token") {
            setStep("email");
            setToken("");
        } else if (step === "password") {
            setStep("token");
            setNewPassword("");
            setConfirmPassword("");
        }
    };

    const renderForm = () => {
        if (step === "email") {
            return (
                <>
                    <Text style={styles.formTitle}>Forgot Password?</Text>
                    <Text style={styles.formSubtitle}>Enter your email address to receive a reset link.</Text>
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
                        <Text style={styles.buttonText}>Send Reset Token</Text>
                        {isLoading && step === "email" && (
                            <ActivityIndicator color={colors.white} style={styles.buttonLoader} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate("Auth")} style={styles.navigationLink}>
                        <Text style={styles.navigationLinkText}>Back to Login</Text>
                    </TouchableOpacity>
                </>
            );
        }

        if (step === "token") {
            return (
                <>
                    <TouchableOpacity onPress={goToPreviousStep} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color={colors.primary} />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.formTitle}>Verify Token</Text>
                    <Text style={styles.formSubtitle}>Please enter the 6-digit token sent to your email.</Text>
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
                        {isLoading && step === "token" && (
                            <ActivityIndicator color={colors.white} style={styles.buttonLoader} />
                        )}
                    </TouchableOpacity>
                </>
            );
        }

        if (step === "password") {
            return (
                <>
                    <TouchableOpacity onPress={goToPreviousStep} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color={colors.primary} />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.formTitle}>Reset Password</Text>
                    <Text style={styles.formSubtitle}>Enter your new password.</Text>
                    <View style={styles.inputContainer}>
                        <Feather name="lock" size={20} color={colors.placeholder} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="New Password"
                            placeholderTextColor={colors.placeholder}
                            secureTextEntry={!showNewPassword}
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />
                        <TouchableOpacity
                            style={styles.passwordVisibilityButton}
                            onPress={() => setShowNewPassword(!showNewPassword)}
                        >
                            <Feather
                                name={showNewPassword ? "eye" : "eye-off"}
                                size={20}
                                color={colors.placeholder}
                            />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.inputContainer}>
                        <Feather name="lock" size={20} color={colors.placeholder} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm New Password"
                            placeholderTextColor={colors.placeholder}
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                        />
                    </View>
                    {message && <Text style={styles.successText}>{message}</Text>}
                    <TouchableOpacity
                        style={[styles.button, styles.primaryButton]}
                        onPress={handleResetPassword}
                        disabled={isLoading}
                    >
                        <Text style={styles.buttonText}>Reset Password</Text>
                        {isLoading && step === "password" && (
                            <ActivityIndicator color={colors.white} style={styles.buttonLoader} />
                        )}
                    </TouchableOpacity>
                </>
            );
        }
        return null;
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
                        {isLoading && step === null && (
                            <View style={styles.loadingOverlay}>
                                <ActivityIndicator size="large" color={colors.primary} />
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <ErrorPopup
                visible={isErrorPopupVisible}
                message={popupErrorMessage}
                onClose={() => setIsErrorPopupVisible(false)}
                colors={colors}
            />
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
        paddingHorizontal: 20,
        justifyContent: "center",
    },
    authContainer: {
        backgroundColor: colors.white,
        width: "95%",
        maxWidth: 400,
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    formTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 10,
        textAlign: "center",
    },
    formSubtitle: {
        fontSize: 16,
        color: colors.placeholder,
        marginBottom: 20,
        textAlign: "center",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.secondary,
        borderRadius: 10,
        marginBottom: 15,
        paddingHorizontal: 15,
    },
    inputIcon: {
        marginRight: 10,
        color: colors.placeholder,
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: 16,
        color: colors.text,
    },
    button: {
        paddingVertical: 14,
        borderRadius: 10,
        marginTop: 20,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
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
        backgroundColor: "rgba(0, 0, 0, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 16,
    },
    successText: {
        color: colors.success,
        marginBottom: 10,
        fontSize: 14,
        textAlign: "center",
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    backButtonText: {
        marginLeft: 8,
        color: colors.primary,
        fontSize: 16,
        fontWeight: "500",
    },
    passwordVisibilityButton: {
        padding: 10,
    },
    buttonLoader: {
        marginLeft: 10,
    },
    navigationLink: {
        marginTop: 15,
    },
    navigationLinkText: {
        color: colors.primary,
        fontSize: 16,
        textAlign: "center",
    },
});

export default ForgotPassword;