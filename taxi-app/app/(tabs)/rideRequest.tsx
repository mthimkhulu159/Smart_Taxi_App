import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Animated,
    SafeAreaView,
    Platform,
    // Alert, // Removed Alert
    ViewStyle // Added for Sidebar typing consistency
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchData, getToken } from '../api/api'; // Assuming correct path
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';
import { RootStackParamList } from '../types/navigation';

// Import the custom popup component
import CustomPopup from '../components/CustomPopup'; // ADJUST PATH if needed

// --- Constants ---
const { width: windowWidth } = Dimensions.get('window'); // Use windowWidth if needed

type RideRequestScreenNavigationProp = StackNavigationProp<RootStackParamList, 'requestRide'>;

// --- Interfaces ---
interface SidebarProps {
    isVisible: boolean;
    onClose: () => void;
    onNavigate: (screen: keyof RootStackParamList) => void;
    activeScreen: keyof RootStackParamList;
}

// --- Loading Component (Copied from HomeScreen/ProfileScreen) ---
const Loading: React.FC = () => {
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            })
        ).start();
    }, [spinAnim]);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradient}>
            <View style={styles.loadingContainerInternal}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="refresh" size={50} color="#003E7E" />
                </Animated.View>
                <Text style={styles.loadingTextInternal}>Loading...</Text>
            </View>
        </LinearGradient>
    );
};

// --- Action Button Component (Copied from ProfileScreen) ---
const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
    ({ onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E', textColor = '#FFFFFF', loading = false, style = {}, disabled = false }) => {
        const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
        const isDisabled = disabled || loading;
        return (
            <TouchableOpacity
                style={[
                    styles.actionButtonBase,
                    { backgroundColor: color },
                    style,
                    isDisabled && styles.actionButtonDisabled // Added disabled style
                ]}
                onPress={onPress}
                disabled={isDisabled}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={textColor} />
                ) : (
                    <>
                        {iconName && <IconComponent name={iconName} size={18} color={textColor} style={styles.actionButtonIcon} />}
                        <Text style={[styles.actionButtonText, { color: textColor }]}>{title}</Text>
                    </>
                )}
            </TouchableOpacity>
        );
};


// --- Main RideRequestScreen Component ---
const RideRequestScreen: React.FC = () => {
    const [requestType, setRequestType] = useState<'ride' | 'pickup'>('ride');
    const [startingStop, setStartingStop] = useState<string>('');
    const [destinationStop, setDestinationStop] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false); // For API call loading

    // State for custom popup
    const [popupVisible, setPopupVisible] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [popupType, setPopupType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
    const [popupDetailedMessage, setPopupDetailedMessage] = useState<string | undefined>(undefined);

    const [sidebarVisible, setSidebarVisible] = useState(false);

    const navigation = useNavigation<RideRequestScreenNavigationProp>();

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Trigger animations on mount
        const animationTimer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
            ]).start();
        }, 100);
        return () => clearTimeout(animationTimer);
    }, [fadeAnim, slideAnim]); // Run once on mount

    // Clear destination when switching to pickup
    useEffect(() => {
        if (requestType === 'pickup') {
            setDestinationStop('');
        }
    }, [requestType]);

    const showPopup = (message: string, type: 'success' | 'error' | 'warning' | 'info', detailedMessage?: string) => {
        setPopupMessage(message);
        setPopupType(type);
        setPopupDetailedMessage(detailedMessage);
        setPopupVisible(true);
    };

    const hidePopup = () => {
        setPopupVisible(false);
        setPopupMessage('');
        setPopupType('info'); // Reset type
        setPopupDetailedMessage(undefined);
    };

    // Function to handle navigation after a successful submission
    const handleSuccessNavigation = () => {
        hidePopup(); // Hide the popup first
        navigation.navigate('AcceptedRequest'); // Navigate to My Ride screen
        // Clear form after successful submission
        setStartingStop('');
        setDestinationStop('');
    };


    const handleSubmit = async () => {
        // --- Input Validation ---
        if (!startingStop.trim()) {
            showPopup('Missing Information', 'warning', 'Please enter the starting stop or rank name.');
            return;
        }
        if (requestType === 'ride' && !destinationStop.trim()) {
            showPopup('Missing Information', 'warning', 'Please enter the destination stop for a ride request.');
            return;
        }

        setIsLoading(true); // Start loading indicator on the button

        try {
            const token = await getToken();
            if (!token) {
                showPopup('Authentication Error', 'error', 'You seem to be logged out. Please log in again.');
                setIsLoading(false);
                // Optionally navigate to login: navigation.navigate('Auth');
                return;
            }

            let endpoint = '';
            let body: any = {};

            if (requestType === 'ride') {
                endpoint = 'api/rideRequest/ride';
                body = { startingStop: startingStop.trim(), destinationStop: destinationStop.trim() };
            } else { // pickup
                endpoint = 'api/rideRequest/pickup';
                body = { startingStop: startingStop.trim() };
            }

            // Make the API call
            const response = await fetchData(apiUrl, endpoint, {
                method: 'POST',
                body,
                // headers implicitly handled by fetchData if it includes Authorization
            });

            // Check response status or data if needed. Assuming success if no error thrown.
            console.log('Request Response:', response); // Log response for debugging

            // Use custom popup for success
            showPopup('Request Submitted', 'success', 'Your request has been successfully submitted. You can view its status under "My Ride".');

            // Navigation and form clearing now happen via handleSuccessNavigation,
            // which is triggered by the OK button on the success popup.

        } catch (err: any) {
            console.error('Error submitting request:', err);
            // Provide more specific error messages if possible based on error type or message
            let errorMessage = 'Failed to submit request. Please try again later.';
            let detailedErrorMessage = err.message || 'An unknown error occurred.';

            // Use custom popup for error
            showPopup('Submission Error', 'error', errorMessage + '\nDetails: ' + detailedErrorMessage);

        } finally {
            setIsLoading(false); // Stop loading indicator
        }
    };

    // Consistent Navigation Handler
    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false);
        switch (screen) {
            case 'Home':
                navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true });
                break;
            case 'requestRide':
                break; // Already here
            case 'ViewTaxi':
                navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true });
                break;
            case 'ViewRoute':
                navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true });
                break;
            case 'ViewRequests':
                navigation.navigate({ name: 'ViewRequests', params: undefined, merge: true });
                break;
            case 'TaxiFareCalculator':
                navigation.navigate({ name: 'TaxiFareCalculator', params: undefined, merge: true }); break;
            case 'TaxiManagement':
                navigation.navigate({ name: 'TaxiManagement', params: undefined, merge: true });
                break;
            case 'Profile':
                navigation.navigate({ name: 'Profile', params: undefined, merge: true });
                break;
            case 'AcceptedRequest':
                navigation.navigate({ name: 'AcceptedRequest', params: undefined, merge: true });
                break;
            case 'AcceptedPassenger':
                navigation.navigate({ name: 'AcceptedPassenger', params: undefined, merge: true });
                break;
            case 'Auth':
                 // Consider if you want to reset the navigation stack on logout/auth screen
                 navigation.reset({
                    index: 0,
                    routes: [{ name: 'Auth' }],
                });
                break;
            default:
                console.warn(`Attempted to navigate to unhandled screen: ${screen}`);
                break;
        }
    };

    const toggleSidebar = () => {
        setSidebarVisible(!sidebarVisible);
    };

    // --- Render Logic ---
    // This screen doesn't have a primary loading state like Profile,
    // but keeping the Loading component definition is fine.
    // We mainly use the inline isLoading state for the button.

    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                {/* Use the Sidebar component defined above */}
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="requestRide" />

                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    {/* Header (Matches HomeScreen/ProfileScreen) */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}>
                            <Ionicons name="menu" size={32} color="#003E7E" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Request Ride</Text>
                        <View style={styles.headerButton} />
                        {/* Optional: Right header button */}
                        {/* <TouchableOpacity style={styles.headerButton} onPress={() => handleNavigate('Profile')}>
                            <FontAwesome name="user-circle-o" size={28} color="#003E7E" />
                        </TouchableOpacity> */}
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled" // Good for forms
                    >
                        {/* Request Type Toggle - Redesigned */}
                        <View style={styles.requestTypeContainer}>
                            <TouchableOpacity
                                style={[styles.requestTypeButton, requestType === 'ride' && styles.requestTypeButtonActive]}
                                onPress={() => setRequestType('ride')}
                            >
                                <MaterialIcons name="directions-car" size={20} color={requestType === 'ride' ? '#FFFFFF' : '#003E7E'} style={styles.requestTypeIcon} />
                                <Text style={[styles.requestTypeText, requestType === 'ride' && styles.requestTypeTextActive]}>Ride Request</Text>
                                <Text style={[styles.requestTypeSubText, requestType === 'ride' && styles.requestTypeButtonActive_SubText]}>
                                    (Origin & Destination)
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.requestTypeButton, requestType === 'pickup' && styles.requestTypeButtonActive]}
                                onPress={() => setRequestType('pickup')}
                            >
                                <MaterialIcons name="hail" size={20} color={requestType === 'pickup' ? '#FFFFFF' : '#003E7E'} style={styles.requestTypeIcon} />
                                <Text style={[styles.requestTypeText, requestType === 'pickup' && styles.requestTypeTextActive]}>Pickup Request</Text>
                                <Text style={[styles.requestTypeSubText, requestType === 'pickup' && styles.requestTypeButtonActive_SubText]}>
                                    (Specific Location)
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Form Section */}
                        <View style={styles.formSection}>
                            <Text style={styles.sectionTitle}>Request Details</Text>

                            <TextInput
                                style={styles.input} // Use consistent input style
                                value={startingStop}
                                onChangeText={setStartingStop}
                                placeholder="Starting Stop / Rank / Location"
                                placeholderTextColor="#aaa"
                            />

                            {requestType === 'ride' && (
                                // Conditional rendering with smooth animation (optional but nice)
                                <Animated.View>
                                    <TextInput
                                        style={styles.input}
                                        value={destinationStop}
                                        onChangeText={setDestinationStop}
                                        placeholder="Destination Stop / Rank"
                                        placeholderTextColor="#aaa"
                                    />
                                </Animated.View>
                            )}

                            {/* Use ActionButton defined above */}
                            <ActionButton
                                title="Submit Request"
                                onPress={handleSubmit}
                                loading={isLoading}
                                iconName="send-outline"
                                style={{ marginTop: 20 }} // Add some margin top
                                disabled={isLoading} // Explicitly disable when loading
                            />
                            {/* Removed inline error/success messages, using Alert now */}
                        </View>

                    </ScrollView>
                </Animated.View>

                 {/* Custom Popup Component */}
                 <CustomPopup
                    visible={popupVisible}
                    message={popupMessage}
                    type={popupType}
                    detailedMessage={popupDetailedMessage}
                    // If the popup type is 'success', onClose should navigate. Otherwise, just hide.
                    onClose={popupType === 'success' ? handleSuccessNavigation : hidePopup}
                    // You could add onRetry logic here if needed for specific error types
                    // onRetry={handleRetryLogic}
                />

            </SafeAreaView>
        </LinearGradient>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    // Keep gradient, safeArea, mainContainer, header, headerButton, headerTitle styles
    // identical to ProfileScreen for consistency
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    mainContainer: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? 15 : 10,
        paddingBottom: 10,
        width: '100%',
    },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },

    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 20, // Give some space below header
    },
    // Redesigned Request Type Toggle
    requestTypeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around', // Space out buttons
        marginBottom: 30,
    },
    requestTypeButton: {
        flex: 1, // Each button takes half the space roughly
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderWidth: 1.5,
        borderColor: '#003E7E',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 5, // Space between buttons
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    requestTypeButtonActive: {
        backgroundColor: '#003E7E', // Theme blue background when active
        borderColor: '#003E7E',
        elevation: 4,
        shadowOpacity: 0.2,
    },
    requestTypeIcon: {
        marginBottom: 5,
    },
    requestTypeText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#003E7E', // Theme blue text when inactive
        textAlign: 'center',
    },
    requestTypeTextActive: {
        color: '#FFFFFF', // White text when active
    },
    requestTypeSubText: {
        fontSize: 12,
        color: '#666', // Grey text when inactive
        marginTop: 2,
        textAlign: 'center',
    },
    requestTypeButtonActive_SubText: { // Style for active subtext
        color: '#E0EFFF', // Lighter blue/white blend when active
    },
    // Form Section
    formSection: {
        // No card background needed, elements sit on gradient
        marginBottom: 20,
    },
    sectionTitle: { // Consistent section title
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 20, // Space below title
    },
    // Input Style (Consistent with ProfileScreen)
    input: {
        backgroundColor: '#FFFFFF', // White background for better contrast on gradient
        borderWidth: 1,
        borderColor: '#D0D0D0',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 14, // Slightly taller inputs
        fontSize: 16,
        color: '#000000',
        marginBottom: 15,
        elevation: 1, // Subtle shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },

    // Action Button Styles (Copied from ProfileScreen)
    actionButtonBase: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600' },
    actionButtonDisabled: {
        backgroundColor: '#A0A0A0', // Grey out when disabled
        elevation: 0,
        shadowOpacity: 0,
    },

    // Removed old styles: title, toggleContainer, toggleButtonType, activeToggle, toggleText,
    // activeToggleText, form, label, submitButton, submitButtonText, errorText, successText
    // Removed old sidebar styles if they existed here

    // --- Sidebar Styles (Copied from HomeScreen/ProfileScreen) ---
    // These styles are likely defined within the Sidebar component itself,
    // but keeping them here as a reference if needed for context or if Sidebar
    // uses external styles. Assuming Sidebar is a separate component.
    sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: 10, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 },
    sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
    sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },


    // --- Loading Styles (Copied from HomeScreen/ProfileScreen) ---
    // Assuming the Loading component uses these styles internally,
    // but keeping them here for completeness as they were in the original code.
    loadingGradient: { flex: 1 },
    loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
});

export default RideRequestScreen;