import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Alert,
    KeyboardAvoidingView, // <-- Keep this import
    Platform,             // <-- Keep this import
    ScrollView,           // <-- Keep this import
    Dimensions,
    ActivityIndicator,
    Easing,
} from "react-native";
import { AntDesign, Feather } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../types/navigation"; // Adjust path if needed
import { fetchData } from "../api/api"; // Adjust path if needed
import { useAuth } from "../context/authContext"; // Adjust path if needed
import { LinearGradient } from 'expo-linear-gradient';
import { apiUrl } from "../api/apiUrl";

const { width } = Dimensions.get("window");

// --- Configuration ---
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"; // ** IMPORTANT: Replace with your actual Google Client ID **

// --- Color Palette ---
const colors = {
    primary: '#6C63FF',
    primaryDark: '#574EDB',
    secondary: '#F0F2F5',
    backgroundGradientStart: '#7F78FF',
    backgroundGradientEnd: '#6C63FF',
    text: '#333',
    textLight: '#FFF',
    placeholder: '#A0A0A0',
    white: '#FFFFFF',
    black: '#000000',
    error: '#E53E3E',
    googleRed: '#DB4437',
    shadow: '#000',
    tabInactive: '#A0A0A0',
    tabActive: '#6C63FF',
};

// --- AuthScreen Component ---
const AuthScreen = () => {
    const { login } = useAuth();
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigation = useNavigation<StackNavigationProp<RootStackParamList, "Home">>(); // Adjust "Home" if needed

    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        clientId: GOOGLE_CLIENT_ID,
    });

    const tabTranslateX = useRef(new Animated.Value(0)).current;
    const formOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const handleGoogleResponse = async () => {
            if (response?.type === "success") {
                setIsLoading(true);
                const { id_token } = response.params;
                const endpoint = activeTab === 'signup' ? "auth/google/signup" : "auth/google/login";

                try {
                    const apiResponse = await fetchData(apiUrl, endpoint, {
                        method: "POST",
                        body: { token: id_token },
                    });

                    if (apiResponse?.token) {
                        await login(apiResponse.token);
                        setTimeout(() => Alert.alert("Success", `Welcome ${activeTab === 'signup' ? "!" : "back!"}`), 500);
                        navigation.navigate("Home"); // Adjust "Home" if needed
                    } else {
                        throw new Error(apiResponse?.message || "Google authentication failed.");
                    }
                } catch (error: any) {
                    console.error("Google Sign-In Error:", error);
                    Alert.alert("Error", error?.message || "An error occurred during Google sign-in.");
                } finally {
                    setIsLoading(false);
                }
            } else if (response?.type === "error") {
                 console.error("Google Auth Error Response:", response.error);
                 Alert.alert("Error", "Google sign-in was cancelled or failed. Please try again.");
            } else if (response?.type === 'cancel'){
                 console.log("Google sign-in cancelled by user.");
                 // Optionally show a subtle feedback or just do nothing
            }
        };

        handleGoogleResponse();
    }, [response, activeTab, login, navigation]);


    const switchTab = (tab: 'login' | 'signup') => {
        if (tab === activeTab) return;

        const targetValue = tab === 'login' ? 0 : (width * 0.9 - 40) / 2;

        Animated.parallel([
            Animated.timing(formOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
                easing: Easing.ease,
            }),
            Animated.spring(tabTranslateX, {
                toValue: targetValue,
                friction: 7,
                tension: 50,
                useNativeDriver: true,
            })
        ]).start(() => {
            setActiveTab(tab);
            setEmail('');
            setPassword('');
            setName('');
            Animated.timing(formOpacity, {
                toValue: 1,
                duration: 150,
                delay: 50,
                useNativeDriver: true,
                easing: Easing.ease,
            }).start();
        });
    };

    const handleSignUpSubmit = async () => {
        if (!name || !email || !password) {
            Alert.alert("Missing Information", "Please fill in all fields.");
            return;
        }
        setIsLoading(true);
        const endpoint = "auth/register";
        const body = { name, email, password };

        try {
            const response = await fetchData(apiUrl, endpoint, { method: "POST", body });
            if (response?.token) {
                await login(response.token);
                setTimeout(() => Alert.alert("Success", "Account created successfully!"), 500);
                navigation.navigate("Home"); // Adjust "Home" if needed
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
        const endpoint = "auth/login";
        const body = { email, password };

        try {
            const response = await fetchData(apiUrl, endpoint, { method: "POST", body });
            if (response?.token) {
                await login(response.token);
                setTimeout(() => Alert.alert("Success", "Welcome back!"), 500);
                navigation.navigate("Home"); // Adjust "Home" if needed
            } else {
                 throw new Error(response?.message || "Invalid credentials.");
            }
        } catch (error: any) {
             console.error("Login Error:", error);
             Alert.alert("Error", error?.message || "Invalid credentials. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        promptAsync();
    };

    const renderForm = () => {
        const commonInputs = (
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
                <View style={styles.inputContainer}>
                    <Feather name="lock" size={20} color={colors.placeholder} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor={colors.placeholder}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>
            </>
        );

        if (activeTab === "login") {
            return (
                <>
                    {commonInputs}
                    <TouchableOpacity
                        style={[styles.button, styles.primaryButton]}
                        onPress={handleLoginSubmit}
                        disabled={isLoading}
                    >
                        <Text style={styles.buttonText}>Login</Text>
                    </TouchableOpacity>
                    <Text style={styles.orText}>or</Text>
                    <TouchableOpacity
                        style={[styles.button, styles.googleButton]}
                        onPress={handleGoogleLogin}
                        disabled={isLoading || !request}
                    >
                        <AntDesign name="google" size={20} color={colors.white} />
                        <Text style={styles.googleText}>Login with Google</Text>
                    </TouchableOpacity>
                </>
            );
        } else { // Sign Up
            return (
                <>
                    <View style={styles.inputContainer}>
                        <Feather name="user" size={20} color={colors.placeholder} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            placeholderTextColor={colors.placeholder}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                    </View>
                    {commonInputs}
                    <TouchableOpacity
                        style={[styles.button, styles.primaryButton]}
                        onPress={handleSignUpSubmit}
                        disabled={isLoading}
                    >
                        <Text style={styles.buttonText}>Sign Up</Text>
                    </TouchableOpacity>
                     <Text style={styles.orText}>or</Text>
                    <TouchableOpacity
                        style={[styles.button, styles.googleButton]}
                        onPress={handleGoogleLogin}
                        disabled={isLoading || !request}
                    >
                        <AntDesign name="google" size={20} color={colors.white} />
                        <Text style={styles.googleText}>Sign Up with Google</Text>
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
            {/* --- MODIFICATION START --- */}
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer}
                // Use "padding" for iOS, let Android handle it natively (often requires windowSoftInputMode="adjustResize" in AndroidManifest.xml)
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                // Keep the offset, adjust if needed based on headers/footers outside this screen
                keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
            >
                <ScrollView
                    // Changed contentContainerStyle: removed justifyContent: 'center'
                    contentContainerStyle={styles.scrollContainer}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false} // Hide scrollbar unless needed
                >
            {/* --- MODIFICATION END --- */}
                    {/* Optional: Add Logo/Title here */}
                    {/* <Image source={require('./path/to/your/logo.png')} style={styles.logo} /> */}
                    {/* <Text style={styles.title}>Welcome</Text> */}

                    <View style={styles.authContainer}>
                        {/* Tab Switcher */}
                        <View style={styles.tabOuterContainer}>
                            <View style={styles.tabInnerContainer}>
                                <Animated.View
                                    style={[
                                        styles.tabIndicator,
                                        { transform: [{ translateX: tabTranslateX }] },
                                    ]}
                                />
                                <TouchableOpacity
                                    style={styles.tab}
                                    onPress={() => switchTab("login")}
                                >
                                    <Text style={[styles.tabText, activeTab === 'login' && styles.activeTabText]}>Login</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.tab}
                                    onPress={() => switchTab("signup")}
                                >
                                    <Text style={[styles.tabText, activeTab === 'signup' && styles.activeTabText]}>Sign Up</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Form Content */}
                        <Animated.View style={[styles.formContent, { opacity: formOpacity }]}>
                           {renderForm()}
                        </Animated.View>

                         {/* Loading Overlay */}
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

// --- Styles ---
const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    keyboardAvoidingContainer: {
        flex: 1, // Make KAV fill the gradient container
    },
    scrollContainer: {
        flexGrow: 1, // Allow content to grow and enable scrolling
        // Removed justifyContent: "center" to prevent jumps
        alignItems: "center", // Keep content centered horizontally
        paddingVertical: 40, // Keep vertical padding for spacing top/bottom
        paddingHorizontal: 10, // Add horizontal padding for smaller screens if needed
    },
    // Optional Logo/Title styles
    // logo: { ... },
    // title: { ... },
    authContainer: {
        backgroundColor: colors.white,
        width: "90%",
        maxWidth: 400,
        borderRadius: 20,
        padding: 20,
        paddingTop: 0, // Tabs manage their own top spacing
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
        overflow: 'hidden',
        position: 'relative', // For loading overlay
        // Add some margin if removing justifyContent makes it stick to the top/bottom edge
        marginVertical: 20, // Ensures some space even without justifyContent center
    },
    tabOuterContainer: {
        marginBottom: 25,
        marginTop: 20,
        paddingHorizontal: 0,
    },
    tabInnerContainer: {
        flexDirection: "row",
        backgroundColor: colors.secondary,
        borderRadius: 30,
        height: 50,
        position: 'relative',
        overflow: 'hidden',
    },
    tab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    tabText: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.tabInactive,
    },
    activeTabText: {
        color: colors.tabActive,
    },
    tabIndicator: {
        position: "absolute",
        height: '100%',
        width: '50%',
        backgroundColor: colors.white,
        borderRadius: 30,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: -1, // Render behind text
    },
    formContent: {
        width: "100%",
        alignItems: "center",
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
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
        alignItems: "center",
        justifyContent: 'center',
        marginTop: 10,
        flexDirection: 'row',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    primaryButton: {
        backgroundColor: colors.primary,
    },
    buttonText: {
        color: colors.textLight,
        fontWeight: "bold",
        fontSize: 16,
    },
    orText: {
        color: colors.placeholder,
        marginVertical: 15,
        fontSize: 14,
        fontWeight: '500',
    },
    googleButton: {
        backgroundColor: colors.googleRed,
        marginTop: 0,
    },
    googleText: {
        color: colors.white,
        fontWeight: "bold",
        marginLeft: 10,
        fontSize: 16,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20, // Match parent container's border radius
        zIndex: 10,
    },
});

export default AuthScreen;