import React, { useState, useEffect, useRef, ElementRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Easing,
    LayoutChangeEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../types/navigation"; // Adjust path as needed
import { fetchData } from "../api/api"; // Adjust path as needed
import { useAuth } from "../context/authContext"; // Adjust path as needed
// Removed LinearGradient as we're using a solid background
import { apiUrl } from "../api/apiUrl"; // Adjust path as needed

const { width, height } = Dimensions.get("window");

// --- REDESIGNED Color Palette (Black, Blue, White) ---
const colors = {
    background: '#29335C',           // Black background
    primaryAccent: '#007AFF',         // Vibrant Blue accent (e.g., iOS blue)
    textPrimary: '#FFFFFF',           // White main text
    textSecondary: 'rgba(255, 255, 255, 0.7)', // Dimmer white/grey
    placeholder: 'rgba(255, 255, 255, 0.6)', // Lighter placeholder for dark bg
    inputBorder: 'rgba(255, 255, 255, 0.4)',  // Subtle white border for inputs
    inputBackground: 'rgba(255, 255, 255, 0.1)', // Optional: slight contrast for input field
    error: '#FF3B30',                 // Standard Red for errors (iOS red)
    link: '#007AFF',                  // Blue for links (same as accent)
    tabInactive: 'rgba(255, 255, 255, 0.7)', // Dim white for inactive tab
    tabActive: '#FFFFFF',               // Bright white for active tab
    tabIndicator: '#007AFF',          // Blue indicator
    buttonText: '#FFFFFF',              // White text on blue button
    loadingBg: 'rgba(0, 0, 0, 0.7)',    // Dark overlay for loading
    black: '#000000',                   // Explicit black for shadows etc.
    white: '#FFFFFF',                   // Explicit white
    blue: '#007AFF',                   // Explicit blue
};

// --- AuthScreen Component ---
const AuthScreen = () => {
    const { login } = useAuth();
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigation = useNavigation<StackNavigationProp<RootStackParamList, "Home">>();

    // Animation values
    const formOpacity = useRef(new Animated.Value(1)).current;
    const formTranslateY = useRef(new Animated.Value(0)).current;
    const tabIndicatorX = useRef(new Animated.Value(0)).current;
    const tabIndicatorWidth = useRef(new Animated.Value(0)).current;

    // Refs for layout measurement
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
            Animated.timing(formOpacity, { toValue: 0, duration: 200, easing: Easing.ease, useNativeDriver: true }),
            Animated.timing(formTranslateY, { toValue: -20, duration: 200, easing: Easing.ease, useNativeDriver: true }),
        ]).start(() => {
            setActiveTab(tab);
            // Reset fields when switching tabs
            setEmail('');
            setPassword('');
            setName('');
            formTranslateY.setValue(20); // Prepare for entry animation

            Animated.parallel([
                 Animated.timing(formOpacity, { toValue: 1, duration: 200, easing: Easing.ease, delay: 50, useNativeDriver: true }),
                 Animated.timing(formTranslateY, { toValue: 0, duration: 200, easing: Easing.ease, delay: 50, useNativeDriver: true }),
            ]).start();
        });
    };

     // --- Form Submission Handlers ---
     const handleSignUpSubmit = async () => {
        if (!name || !email || !password) {
            Alert.alert("Missing Information", "Please fill in all fields.");
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetchData(apiUrl, "auth/register", { method: "POST", body: { name, email, password } });
            if (response?.token) {
                await login(response.token);
                navigation.navigate("Home");
            } else {
                throw new Error(response?.message || "Registration failed.");
            }
        } catch (error: any) {
            console.error("Sign Up Error:", error);
            Alert.alert("Error", error?.message || "An error occurred during sign up.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginSubmit = async () => {
        if (!email || !password) {
            Alert.alert("Missing Information", "Please enter email and password.");
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetchData(apiUrl, "auth/login", { method: "POST", body: { email, password } });
            if (response?.token) {
                await login(response.token);
                navigation.navigate("Home");
            } else {
                throw new Error(response?.message || "Invalid credentials.");
            }
        } catch (error: any) {
             console.error("Login Error:", error);
             Alert.alert("Error", error?.message || "Invalid credentials or login failed.");
        } finally {
             setIsLoading(false);
         }
    };

    const handleForgotPassword = () => {
        console.log("Navigate to Forgot Password Screen");
        navigation.navigate('ForgotPassword'); // Add this screen to RootStackParamList
        Alert.alert("Forgot Password", "Password reset functionality is not yet implemented.");
    };

    // --- Render Form Function ---
    const renderForm = () => {
        const commonInputs = (
            <>
                <View style={styles.inputGroup}>
                     <Feather name="mail" size={20} color={colors.placeholder} style={styles.inputIcon} />
                     <TextInput
                         style={styles.input}
                         placeholder="Email Address"
                         placeholderTextColor={colors.placeholder}
                         keyboardType="email-address"
                         value={email}
                         onChangeText={setEmail}
                         autoCapitalize="none"
                         textContentType="emailAddress"
                         selectionColor={colors.primaryAccent} // Blue cursor
                         keyboardAppearance="dark" // Hint for dark keyboard on iOS
                     />
                </View>
                <View style={styles.inputGroup}>
                     <Feather name="lock" size={20} color={colors.placeholder} style={styles.inputIcon} />
                     <TextInput
                         style={styles.input}
                         placeholder="Password"
                         placeholderTextColor={colors.placeholder}
                         secureTextEntry
                         value={password}
                         onChangeText={setPassword}
                         textContentType="password"
                         selectionColor={colors.primaryAccent} // Blue cursor
                         keyboardAppearance="dark" // Hint for dark keyboard on iOS
                     />
                </View>
            </>
        );

        return (
            <Animated.View style={[
                styles.formContainer,
                { opacity: formOpacity, transform: [{ translateY: formTranslateY }] }
            ]}>
                {activeTab === 'signup' && (
                     <View style={styles.inputGroup}>
                         <Feather name="user" size={20} color={colors.placeholder} style={styles.inputIcon} />
                         <TextInput
                              style={styles.input}
                              placeholder="Full Name"
                              placeholderTextColor={colors.placeholder}
                              value={name}
                              onChangeText={setName}
                              autoCapitalize="words"
                              textContentType="name"
                              selectionColor={colors.primaryAccent} // Blue cursor
                              keyboardAppearance="dark" // Hint for dark keyboard on iOS
                         />
                     </View>
                )}
                {commonInputs}

                 {activeTab === 'login' && (
                     <TouchableOpacity style={styles.forgotPasswordLink} onPress={handleForgotPassword}>
                         <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                     </TouchableOpacity>
                 )}

                 <TouchableOpacity
                     style={styles.submitButton}
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

    // --- Main Component Return ---
    // Use a standard View with the new background color
    return (
        <View style={styles.backgroundContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* --- Top Visual Area --- */}
                    <View style={styles.topVisualArea}>
                        {/* Simple Text Title - could be replaced with a Logo */}
                        <Text style={styles.appName}>App Title</Text>
                    </View>

                    {/* --- Content Area --- */}
                    <View style={styles.contentArea}>
                        {/* Tab Switcher */}
                        <View style={styles.tabSwitcher}>
                             <TouchableOpacity
                                 ref={loginTabRef}
                                 style={styles.tabButton}
                                 onPress={() => switchTab("login")}
                                 onLayout={(e) => measureTabLayout('login', e)}
                             >
                                 <Text style={[styles.tabText, activeTab === 'login' ? styles.tabTextActive : styles.tabTextInactive]}>
                                     Sign In
                                 </Text>
                             </TouchableOpacity>
                             <TouchableOpacity
                                 ref={signupTabRef}
                                 style={styles.tabButton}
                                 onPress={() => switchTab("signup")}
                                 onLayout={(e) => measureTabLayout('signup', e)}
                              >
                                 <Text style={[styles.tabText, activeTab === 'signup' ? styles.tabTextActive : styles.tabTextInactive]}>
                                     Create Account
                                 </Text>
                             </TouchableOpacity>
                             {/* Animated Underline - Positioned absolutely relative to tabSwitcher */}
                             <Animated.View style={[
                                  styles.tabIndicator,
                                  {
                                      left: tabIndicatorX,
                                      width: tabIndicatorWidth,
                                  }
                             ]} />
                        </View>

                        {/* Render the dynamic form */}
                        {renderForm()}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

             {/* --- Loading Overlay --- */}
             {isLoading && (
                 <View style={styles.loadingOverlay}>
                     {/* Use white indicator on dark overlay */}
                     <ActivityIndicator size="large" color={colors.white} />
                 </View>
             )}
        </View> // Close background Container View
    );
};


// --- Styles ---
const styles = StyleSheet.create({
    // Changed from gradientContainer
    backgroundContainer: {
        flex: 1,
        backgroundColor: colors.background, // Black background
    },
    keyboardAvoidingContainer: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        alignItems: 'center',
        paddingBottom: 40,
    },
    // --- Top Area ---
    topVisualArea: {
        height: height * 0.25, // Reduced height slightly
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 20,
    },
    appName: {
        fontSize: 32, // Slightly smaller
        fontWeight: '600', // Less bold
        color: colors.textPrimary, // White text
        letterSpacing: 0.5,
    },
    // --- Content Area ---
    contentArea: {
        width: '90%',
        maxWidth: 450,
        paddingTop: 10, // Reduced top padding
        alignItems: 'center',
    },
    // --- Tab Styles ---
    tabSwitcher: {
        flexDirection: 'row',
        width: '100%',
        marginBottom: 0, // Removed bottom margin, indicator handles spacing
        position: 'relative', // Context for the absolute indicator
        height: 55, // Fixed height to help position indicator - includes padding + approx text height + buffer
    },
    tabButton: {
        paddingVertical: 15,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center', // Center text vertically too
    },
    tabText: {
        fontSize: 17, // Slightly smaller tab text
        fontWeight: '500', // Medium weight
        textAlign: 'center',
    },
    tabTextActive: {
        color: colors.tabActive, // White
    },
    tabTextInactive: {
        color: colors.tabInactive, // Dim White
    },
    // FIX: Adjusted tabIndicator positioning
    tabIndicator: {
        height: 3,
        backgroundColor: colors.tabIndicator, // Blue indicator
        borderRadius: 1.5,
        position: 'absolute', // Position relative to tabSwitcher
        // Removed 'bottom', using 'top' instead
        top: 45, // Position below the text. Adjust visually if needed (e.g., 48, 50)
        // 'left' and 'width' are animated
    },
    // --- Form Styles ---
    formContainer: {
        width: '100%',
        marginTop: 25, // Space below tabs/indicator
        alignItems: 'center',
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        borderBottomWidth: 1, // Thinner border
        borderBottomColor: colors.inputBorder, // Use subtle white border color
        marginBottom: 20, // Slightly less margin
        paddingBottom: 6,
        // Optional: add subtle background to input field itself
        // backgroundColor: colors.inputBackground,
        // borderRadius: 5, // Add if using background color
        // paddingHorizontal: 10, // Add if using background color
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.textPrimary, // White text
        height: 40,
    },
    forgotPasswordLink: {
        alignSelf: 'flex-end',
        marginBottom: 20,
        paddingVertical: 5,
    },
    forgotPasswordText: {
        color: colors.link, // Blue link
        fontSize: 14,
        fontWeight: '500',
    },
    submitButton: {
        backgroundColor: colors.primaryAccent, // Blue button
        paddingVertical: 15, // Slightly less padding
        width: '100%',
        borderRadius: 8, // Less rounded corners
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: colors.black, // Use black for shadow base
        shadowOffset: { width: 0, height: 2 }, // Smaller shadow
        shadowOpacity: 0.3, // More visible shadow on dark bg maybe?
        shadowRadius: 4,
        elevation: 4,
    },
    submitButtonText: {
        color: colors.buttonText, // White text on button
        fontSize: 16,
        fontWeight: '600', // Semibold
    },
    // --- Loading Overlay ---
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.loadingBg, // Use dark overlay color
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
});

export default AuthScreen;
// Current timestamp: Tuesday, April 15, 2025 at 6:57:00 AM SAST (Mahikeng, North West, South Africa)