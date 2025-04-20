import React, { useState, useEffect, useRef, ElementRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Easing,
    LayoutChangeEvent,
    Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../types/navigation"; // Adjust path as needed
import { fetchData } from "../api/api"; // Adjust path as needed
import { useAuth } from "../context/authContext"; // Adjust path as needed
import { apiUrl } from "../api/apiUrl"; // Adjust path as needed

const { width, height } = Dimensions.get("window");

// --- Color Palette (Keep as defined before) ---
const colors = {
    background: '#29335C',
    primaryAccent: '#007AFF',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    placeholder: 'rgba(255, 255, 255, 0.6)',
    inputBorder: 'rgba(255, 255, 255, 0.4)',
    inputBackground: 'rgba(255, 255, 255, 0.1)',
    error: '#FF3B30',
    link: '#007AFF',
    tabInactive: 'rgba(255, 255, 255, 0.7)',
    tabActive: '#FFFFFF',
    tabIndicator: '#007AFF',
    buttonText: '#FFFFFF',
    loadingBg: 'rgba(0, 0, 0, 0.7)',
    black: '#000000',
    white: '#FFFFFF',
    blue: '#007AFF',
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
                    <Text style={[popupStyles.modalTitle, { color: colors.textPrimary }]}>Error</Text>
                    <Text style={[popupStyles.modalText, { color: colors.textPrimary }]}>{message}</Text>
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


// --- AuthScreen Component ---
const AuthScreen = () => {
    const { login } = useAuth();
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigation = useNavigation<StackNavigationProp<RootStackParamList, "Home">>();

    // State for custom error popup
    const [isErrorPopupVisible, setIsErrorPopupVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Animation values / Refs / Layout Measurement / useEffect / switchTab...
    const formOpacity = useRef(new Animated.Value(1)).current;
    const formTranslateY = useRef(new Animated.Value(0)).current;
    const tabIndicatorX = useRef(new Animated.Value(0)).current;
    const tabIndicatorWidth = useRef(new Animated.Value(0)).current;
    const loginTabRef = useRef<ElementRef<typeof TouchableOpacity>>(null);
    const signupTabRef = useRef<ElementRef<typeof TouchableOpacity>>(null);
    const [tabLayouts, setTabLayouts] = useState<{ [key: string]: { x: number; width: number } }>({});
    const measureTabLayout = (tabName: 'login' | 'signup', event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        if (width > 0) {
            setTabLayouts(prev => ({ ...prev, [tabName]: { x, width } }));
        }
    };
    useEffect(() => {
        if (tabLayouts.login && tabLayouts.signup) {
            const targetLayout = activeTab === 'login' ? tabLayouts.login : tabLayouts.signup;
            const springConfig = { tension: 100, friction: 15, useNativeDriver: false };
            Animated.spring(tabIndicatorX, { toValue: targetLayout.x, ...springConfig }).start();
            Animated.spring(tabIndicatorWidth, { toValue: targetLayout.width, ...springConfig }).start();
        }
    }, [activeTab, tabLayouts, tabIndicatorX, tabIndicatorWidth]);
    const switchTab = (tab: 'login' | 'signup') => {
        if (tab === activeTab || !tabLayouts.login || !tabLayouts.signup) return;
        Animated.parallel([
            Animated.timing(formOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
            Animated.timing(formTranslateY, { toValue: -20, duration: 150, useNativeDriver: false }),
        ]).start(() => {
            setActiveTab(tab);
            setEmail(''); setPassword(''); setName(''); setErrorMessage(''); setIsErrorPopupVisible(false);
            formTranslateY.setValue(20);
            Animated.parallel([
                Animated.timing(formOpacity, { toValue: 1, duration: 200, delay: 50, useNativeDriver: false }),
                Animated.timing(formTranslateY, { toValue: 0, duration: 200, delay: 50, useNativeDriver: false }),
            ]).start();
        });
    };


    // --- Helper function to show the error popup ---
    const showErrorPopup = (message: string) => {
        setErrorMessage(message);
        setIsErrorPopupVisible(true);
    };

    // --- Simple Email Validation Regex ---
    const isValidEmail = (emailToTest: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailToTest);
    };

    // --- Form Submission Handlers (CORRECTED ERROR HANDLING) ---
    const handleSignUpSubmit = async () => {
        if (!name.trim() || !email.trim() || !password.trim()) {
            showErrorPopup("Please fill in all fields."); return;
        }
        if (!isValidEmail(email)) {
            showErrorPopup("Please enter a valid email address."); return;
        }
        if (password.length < 6) {
            showErrorPopup("Password must be at least 6 characters long."); return;
        } 

        setIsLoading(true);
        try {
            const response = await fetchData(apiUrl, "auth/register", {
                method: "POST",
                body: { name: name.trim(), email: email.trim().toLowerCase(), password }
            });

            if (response?.token) {
                await login(response.token);
                navigation.navigate("Home");
            } else {
                showErrorPopup("Registration completed but failed to get login token. Please try signing in.");
            }
        } catch (error: any) {
            console.error("Sign Up Error:", error);
            let displayMessage = error?.message || "An unexpected error occurred during sign up. Please try again later.";
            if (error?.response?.data?.message) {
                displayMessage = error.response.data.message;
            } else if (error?.data?.message) {
                displayMessage = error.data.message;
            }
            showErrorPopup(displayMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginSubmit = async () => {
        if (!email.trim() || !password.trim()) {
            showErrorPopup("Please enter both email and password."); return;
        }
        if (!isValidEmail(email)) {
            showErrorPopup("Please enter a valid email address."); return;
        }

        setIsLoading(true);
        try {
            const response = await fetchData(apiUrl, "auth/login", {
                method: "POST",
                body: { email: email.trim().toLowerCase(), password }
            });

            if (response?.token) {
                await login(response.token);
                navigation.navigate("Home");
            } else {
                showErrorPopup("Login succeeded but failed to get login token. Please try again.");
            }
        } catch (error: any) {
            console.error("Login Error:", error);
            let displayMessage = error?.message || "An unexpected error occurred. Please try again later.";
            if (error?.response?.data?.message) {
                displayMessage = error.response.data.message;
            } else if (error?.data?.message) {
                displayMessage = error.data.message;
            } else if (error?.message === 'Request failed with status code 401') {
                displayMessage = 'Invalid email or password';
            }
            else if (error?.message === 'Request failed with status code 429') {
               displayMessage = 'Too many login attempts from this IP, please try again after an hour.';
           }
            showErrorPopup(displayMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = () => {
        console.log("Navigate to Forgot Password Screen");
        navigation.navigate('ForgotPassword');
    };

    // --- Render Form Function ---
    const renderForm = () => {
        const commonInputs = (
            <>
                <View style={styles.inputGroup}>
                    <Feather name="mail" size={20} color={colors.placeholder} style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor={colors.placeholder} keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" textContentType="emailAddress" selectionColor={colors.primaryAccent} keyboardAppearance="dark" />
                </View>
                <View style={styles.inputGroup}>
                    <Feather name="lock" size={20} color={colors.placeholder} style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.placeholder} secureTextEntry value={password} onChangeText={setPassword} textContentType="password" selectionColor={colors.primaryAccent} keyboardAppearance="dark" />
                </View>
            </>
        );

        return (
            <Animated.View style={[styles.formContainer, { opacity: formOpacity, transform: [{ translateY: formTranslateY }] }]}>
                {activeTab === 'signup' && (
                    <View style={styles.inputGroup}>
                        <Feather name="user" size={20} color={colors.placeholder} style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={colors.placeholder} value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" selectionColor={colors.primaryAccent} keyboardAppearance="dark" />
                    </View>
                )}
                {commonInputs}
                {activeTab === 'login' && (
                    <TouchableOpacity style={styles.forgotPasswordLink} onPress={handleForgotPassword}>
                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                    onPress={activeTab === 'login' ? handleLoginSubmit : handleSignUpSubmit}
                    disabled={isLoading}
                >
                    <Text style={styles.submitButtonText}>
                        {activeTab === 'login' ? 'Sign In' : 'Create Account'}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <View style={styles.backgroundContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Top Visual Area */}
                    <View style={styles.topVisualArea}>
                        <Text style={styles.appName}>Qmarshal</Text>
                    </View>

                    {/* Content Area */}
                    <View style={styles.contentArea}>
                        {/* Tab Switcher */}
                        <View style={styles.tabSwitcher}>
                            <TouchableOpacity ref={loginTabRef} style={styles.tabButton} onPress={() => switchTab("login")} onLayout={(e) => measureTabLayout('login', e)}>
                                <Text style={[styles.tabText, activeTab === 'login' ? styles.tabTextActive : styles.tabTextInactive]}>Sign In</Text>
                            </TouchableOpacity>
                            <TouchableOpacity ref={signupTabRef} style={styles.tabButton} onPress={() => switchTab("signup")} onLayout={(e) => measureTabLayout('signup', e)}>
                                <Text style={[styles.tabText, activeTab === 'signup' ? styles.tabTextActive : styles.tabTextInactive]}>Create Account</Text>
                            </TouchableOpacity>
                            <Animated.View style={[styles.tabIndicator, { left: tabIndicatorX, width: tabIndicatorWidth }]} />
                        </View>

                        {/* Render the dynamic form */}
                        {renderForm()}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Loading Overlay */}
            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.white} />
                </View>
            )}

            {/* Custom Error Popup */}
            <ErrorPopup
                visible={isErrorPopupVisible}
                message={errorMessage}
                onClose={() => setIsErrorPopupVisible(false)}
                colors={colors}
            />
        </View>
    );
};


// --- Styles ---
const styles = StyleSheet.create({
    backgroundContainer: { flex: 1, backgroundColor: colors.background },
    keyboardAvoidingContainer: { flex: 1 },
    scrollContainer: { flexGrow: 1, alignItems: 'center', paddingBottom: 40 },
    topVisualArea: { height: height * 0.25, width: '100%', justifyContent: 'center', alignItems: 'center', paddingTop: 20 },
    appName: { fontSize: 32, fontWeight: '600', color: colors.textPrimary, letterSpacing: 0.5 },
    contentArea: { width: '90%', maxWidth: 450, paddingTop: 10, alignItems: 'center' },
    tabSwitcher: { flexDirection: 'row', width: '100%', position: 'relative', height: 55 },
    tabButton: { paddingVertical: 15, flex: 1, alignItems: 'center', justifyContent: 'center' },
    tabText: { fontSize: 17, fontWeight: '500', textAlign: 'center' },
    tabTextActive: { color: colors.tabActive },
    tabTextInactive: { color: colors.tabInactive },
    tabIndicator: { height: 3, backgroundColor: colors.tabIndicator, borderRadius: 1.5, position: 'absolute', top: 45 },
    formContainer: { width: '100%', marginTop: 25, alignItems: 'center' },
    inputGroup: { flexDirection: 'row', alignItems: 'center', width: '100%', borderBottomWidth: 1, borderBottomColor: colors.inputBorder, marginBottom: 20, paddingBottom: 6 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 16, color: colors.textPrimary, height: 40 },
    forgotPasswordLink: { alignSelf: 'flex-end', marginBottom: 20, paddingVertical: 5 },
    forgotPasswordText: { color: colors.link, fontSize: 14, fontWeight: '500' },
    submitButton: { backgroundColor: colors.primaryAccent, paddingVertical: 15, width: '100%', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
    submitButtonDisabled: { backgroundColor: colors.tabInactive, opacity: 0.7, },
    submitButtonText: { color: colors.buttonText, fontSize: 16, fontWeight: '600' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.loadingBg, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
});

export default AuthScreen;