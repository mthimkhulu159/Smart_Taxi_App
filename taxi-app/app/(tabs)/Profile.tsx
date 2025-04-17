import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    TextInput,
    Alert, // Keep for confirmation dialogs (like logout)
    ScrollView,
    Animated,
    SafeAreaView,
    Platform,
    Dimensions,
    ActivityIndicator,
    // Button, // Removed if not needed for testing
    ViewStyle,
    Modal, // Keep for ErrorPopup
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from "@expo/vector-icons"; // Keep for ErrorPopup Icon
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { fetchData, getToken } from '../api/api'; // Keep
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/authContext';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';

// --- Constants ---
const { width: windowWidth } = Dimensions.get('window');

// --- Navigation Types --- (Keep as is)
type RootStackParamList = {
    Home: { acceptedTaxiId?: string };
    requestRide: undefined;
    ViewTaxi: undefined;
    ViewRequests: undefined;
    LiveChat: undefined;
    TaxiManagement: undefined;
    Profile: undefined;
    AcceptedRequest: undefined;
    AcceptedPassenger: undefined;
    ViewRoute: undefined;
    Auth: undefined;
    TaxiFareCalculator: undefined;
};

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;

// --- Interfaces --- (Keep as is)
interface SidebarProps {
    isVisible: boolean;
    onClose: () => void;
    onNavigate: (screen: keyof RootStackParamList) => void;
    activeScreen: keyof RootStackParamList;
}

interface UserProfile {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: string[];
    profilePic?: string;
}

// --- Color Palette (Updated slightly for consistency with ErrorPopup) ---
const colors = {
    primary: "#003E7E",
    secondary: "#F0F2F5",
    backgroundGradientStart: "#FFFFFF",
    backgroundGradientEnd: "#E8F0FE",
    text: "#333",
    textLight: "#FFF", // Used in ErrorPopup text
    placeholder: "#A0A0A0",
    white: "#FFFFFF",
    error: "#D32F2F", // Used in ErrorPopup icon
    success: "#28A745",
    // Added from AuthScreen for ErrorPopup styling consistency
    background: '#29335C', // Background for the popup modal view
    primaryAccent: '#007AFF', // Button color for the popup
    buttonText: '#FFFFFF', // Text color for the popup button
};

// --- Custom Error Popup Component (Copied from AuthScreen) ---
interface ErrorPopupProps {
    visible: boolean;
    message: string;
    onClose: () => void;
    colors: typeof colors; // Use the defined colors object
}
const ErrorPopup: React.FC<ErrorPopupProps> = ({ visible, message, onClose, colors }) => {
    if (!visible) return null;
    return (
        <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={popupStyles.centeredView}>
                {/* Use colors from props */}
                <View style={[popupStyles.modalView, { backgroundColor: colors.background }]}>
                    <Feather name="alert-circle" size={30} color={colors.error} style={popupStyles.errorIcon} />
                    <Text style={[popupStyles.modalTitle, { color: colors.textLight }]}>Info</Text> {/* Changed title to Info as it's used for success too */}
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


// --- Loading Component (Keep as is) ---
const Loading: React.FC = () => {
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true, })
        ).start();
    }, [spinAnim]);
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'], });
    return (
        <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.loadingGradient}>
            <View style={styles.loadingContainerInternal}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="refresh" size={50} color={colors.primary} />
                </Animated.View>
                <Text style={styles.loadingTextInternal}>Loading...</Text>
            </View>
        </LinearGradient>
    );
};

// --- ActionButton Component (Keep as is, logging can be removed if desired) ---
const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
    ({ onPress, title, iconName, iconFamily = 'Ionicons', color = colors.primary, textColor = colors.white, loading = false, style = {}, disabled = false }) => {
        const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
        const isDisabled = disabled || loading;

        const handlePress = () => {
            // console.log(`--- ActionButton onPress triggered for: ${title} ---`); // Keep or remove debug log
            if (onPress && !isDisabled) { // Ensure disabled state prevents press
                onPress();
            }
        };

        return (
            <TouchableOpacity
                style={[styles.actionButtonBase, { backgroundColor: color, opacity: isDisabled ? 0.6 : 1 }, style]}
                onPress={handlePress}
                disabled={isDisabled}
                activeOpacity={0.7}
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


// --- Main ProfileScreen Component ---
const ProfileScreen: React.FC = () => {
    const navigation = useNavigation<ProfileScreenNavigationProp>();
    const { logout } = useAuth();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [isAddingTaxi, setIsAddingTaxi] = useState(false);
    const [isTaxiFormVisible, setIsTaxiFormVisible] = useState(false);
    const [numberPlate, setNumberPlate] = useState('');
    const [capacity, setCapacity] = useState('');
    const [currentStop, setCurrentStop] = useState('');
    const [routeName, setRouteName] = useState('');
    const [sidebarVisible, setSidebarVisible] = useState(false);

    // --- State for Error Popup ---
    const [isErrorPopupVisible, setIsErrorPopupVisible] = useState(false);
    const [popupErrorMessage, setPopupErrorMessage] = useState<string>('');

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // --- Helper function to show the error/info popup ---
    const showError = (message: string) => {
        setPopupErrorMessage(message);
        setIsErrorPopupVisible(true);
    };

    // --- Helper function to close the error/info popup ---
    const clearError = () => {
        setIsErrorPopupVisible(false);
        // Optionally clear message after fade out animation if needed, but generally not required
        // setPopupErrorMessage('');
    };

    // --- Effects ---
    useEffect(() => {
        const fetchUserProfile = async () => {
            setIsLoading(true);
            // Reset previous errors when fetching
            clearError();
            const token = await getToken();
            if (token) {
                try {
                    const response = await fetchData(apiUrl, 'api/users/get-user', { method: 'GET' });
                    if (response?.user) {
                        setUser(response.user);
                        setName(response.user.name);
                        setPhone(response.user.phone);
                    } else {
                        // Use a more specific error if possible from response
                        throw new Error(response?.message || 'Failed to retrieve valid user data.');
                    }
                } catch (error: any) {
                    console.error('Error fetching user profile:', error);
                    // Extract message from common error structures
                    let displayMessage = "Failed to fetch your profile data. Please try again later.";
                    if (error?.response?.data?.message) {
                        displayMessage = error.response.data.message;
                    } else if (error?.data?.message) {
                         displayMessage = error.data.message;
                    } else if (error?.message) {
                         displayMessage = error.message;
                    }
                    showError(displayMessage);
                    setUser(null); // Clear user data on error
                } finally {
                    setIsLoading(false);
                }
            } else {
                // Handle missing token case
                showError('Your session has expired. Please log in again.');
                setIsLoading(false);
                setUser(null);
                try {
                    await logout();
                    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                } catch (logoutError) {
                    console.error("Error during automatic logout:", logoutError);
                    // Show additional error for logout failure if needed
                    showError("Session expired. An error also occurred during automatic logout.");
                }
            }
        };
        fetchUserProfile();
    }, [navigation, logout]); // Dependencies

    useEffect(() => {
        // Animation effect (Keep as is)
        if (!isLoading && user) { // Only animate if loading is finished and user data is available
            const animationTimer = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                ]).start();
            }, 100);
            return () => clearTimeout(animationTimer);
        } else {
             // Reset animation values if loading or no user
             fadeAnim.setValue(0);
             slideAnim.setValue(30);
        }
    }, [isLoading, user, fadeAnim, slideAnim]); // Add user dependency

    // --- Handlers ---

    const handleSave = async () => {
        // Client-side validation using showError
        if (!name.trim() || !phone.trim()) {
            showError('Name and phone cannot be empty.');
            return;
        }
        setIsSaving(true);
        clearError(); // Clear previous errors
        if (user) {
            try {
                const response = await fetchData(apiUrl, 'api/users/update-details', {
                    method: 'PUT',
                    body: { name: name.trim(), phone: phone.trim() },
                });

                if (response?.user) {
                    // Update state based on response
                    setUser(currentUser => ({
                         ...(currentUser ?? {} as UserProfile), // Handle potential null case
                         name: response.user.name || currentUser?.name,
                         phone: response.user.phone || currentUser?.phone,
                         // Keep other fields like email, role, _id
                         email: currentUser?.email ?? response.user.email,
                         role: currentUser?.role ?? response.user.role,
                         _id: currentUser?._id ?? response.user._id,
                    }));
                    setName(response.user.name || name);
                    setPhone(response.user.phone || phone);
                    setIsEditing(false);
                    // Use showError for success message as per existing pattern
                    showError('Profile updated successfully!');
                } else {
                    throw new Error(response?.message || 'Update response did not contain user data.');
                }
            } catch (error: any) {
                console.error('Error updating profile:', error);
                 let displayMessage = "Failed to update profile. Please try again.";
                 if (error?.response?.data?.message) {
                     displayMessage = error.response.data.message;
                 } else if (error?.data?.message) {
                      displayMessage = error.data.message;
                 } else if (error?.message) {
                      displayMessage = error.message;
                 }
                showError(displayMessage);
            } finally {
                 setIsSaving(false);
            }
        } else {
            showError('Cannot save: User data is not available.');
            setIsSaving(false); // Ensure loading state is reset
        }
    };
    const handleUpgradeRole = async () => {
        clearError(); // Clear previous errors
        // Validation checks
        if (user?.role?.includes('driver')) {
          showError('Your account already has driver privileges.');
          return;
        }
        if (!user) {
          showError('User data missing. Cannot upgrade role.');
          return;
        }
    
        setIsUpgrading(true);
    
        try {
          console.log("Attempting role upgrade...");
          const response = await fetchData(apiUrl, 'api/users/upgrade-role', { method: 'PUT' });
          console.log("Role upgrade response received:", response);
    
          // Handle successful submission of the upgrade request
          if (response?.message) {
            showError(response.message); // e.g., "Your request for an upgrade to driver has been sent for approval"
            // Optionally, you might want to update the user state to reflect that an upgrade is pending
            setUser(prevUser => {
              if (prevUser) {
                return { ...prevUser, roleUpgradeRequested: true };
              }
              // Handle the case where prevUser might be null (consider your app's logic)
              return { roleUpgradeRequested: true } as any;
            });
          }
          // Handle unexpected success scenario where the role might be immediately updated (though backend suggests otherwise)
          else if (response?.user?.role?.includes('driver')) {
            setUser(response.user);
            showError('Your account has been upgraded to Driver!');
          }
          // Handle unexpected error or no message in the success response
          else if (response?.error) {
            console.warn("Role upgrade request failed:", response);
            showError(response.error);
          }
          // Handle other unexpected scenarios
          else {
            console.warn("Unexpected response format for role upgrade:", response);
            showError('Something went wrong while submitting the upgrade request.');
          }
        } catch (error: any) {
          console.error('Error upgrading role:', error);
          let displayMessage = "Failed to submit upgrade request. Please try again or contact support.";
          if (error?.response?.data?.message) {
            displayMessage = error.response.data.message;
          } else if (error?.data?.message) {
            displayMessage = error.data.message;
          } else if (error?.message) {
            displayMessage = error.message;
          }
          showError(displayMessage);
        } finally {
          setIsUpgrading(false);
        }
      };
      
    const handleLogout = () => {
        // Use Alert.alert for confirmation - This is appropriate for interactive dialogs
        Alert.alert(
            "Confirm Logout",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        clearError(); // Clear any previous popups
                        try {
                            await logout(); // Call the logout function from context
                            // Navigate to Auth screen after successful logout
                            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                        } catch (error: any) {
                            console.error("Error during logout process:", error);
                            // Use showError for errors *during* the logout API call or cleanup
                            showError("An unexpected error occurred during logout.");
                        }
                    }
                }
            ],
            { cancelable: true }
        );
    };

    // --- Taxi Registration Handler ---
    const handleAddTaxi = async () => {
        clearError(); // Clear previous errors

        // Client-side validation using showError
        if (!numberPlate.trim() || !capacity.trim() || !routeName.trim() || !currentStop.trim()) {
            showError('Please fill in all required taxi details (Number Plate, Capacity, Route, Current Stop).');
            return;
        }
        const parsedCapacity = parseInt(capacity, 10);
        if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
            showError('Please enter a valid positive number for capacity.');
            return;
        }

        setIsAddingTaxi(true);
        try {
            const body = {
                 numberPlate: numberPlate.trim().toUpperCase(), // Standardize format
                 routeName: routeName.trim(),
                 capacity: parsedCapacity,
                 currentStop: currentStop.trim(),
            };
            console.log("Adding taxi with data:", body); // Log data being sent
            const response = await fetchData(apiUrl, 'api/taxis/addTaxi', {
                 method: 'POST',
                 body: body,
             });

            console.log("Add taxi response:", response); // Log response

            if (response?.taxi?._id) { // Check for a key property of the added taxi
                showError(`Taxi ${response.taxi.numberPlate} added successfully!`);
                // Clear form and hide it
                setNumberPlate('');
                setCapacity('');
                setCurrentStop('');
                setRouteName('');
                setIsTaxiFormVisible(false);
                // Optionally: Refresh user data or navigate if needed
            } else {
                // Throw error if response doesn't look successful
                throw new Error(response?.message || 'Failed to add taxi. Response format incorrect.');
            }
        } catch (error: any) {
            console.error('Error adding taxi:', error);
             let displayMessage = "Failed to add taxi. Please try again.";
             if (error?.response?.data?.message) { // Check for specific backend message
                 displayMessage = error.response.data.message;
             } else if (error?.data?.message) {
                  displayMessage = error.data.message;
             } else if (error?.message) {
                  displayMessage = error.message; // Fallback to generic error message
             }
             // Handle specific common errors if needed
             if (displayMessage.includes('duplicate key error') && displayMessage.includes('numberPlate')) {
                displayMessage = `A taxi with number plate ${numberPlate.trim().toUpperCase()} already exists.`;
             }
            showError(displayMessage);
        } finally {
            setIsAddingTaxi(false);
        }
    };

    // --- Navigation Handlers --- (Keep as is)
    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false);
        if (screen === 'Auth') {
            handleLogout();
        } else if (screen === 'Profile') {
            // Already on Profile, just close sidebar
        } else {
            navigation.navigate({ name: screen, params: undefined, merge: true } as any);
        }
    };

    const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

    // --- Render Logic ---

    // Loading State
    if (isLoading) { return <Loading />; }

    // Error State (Failed initial load)
    if (!user && !isLoading) {
        return (
            <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.gradient}>
                <SafeAreaView style={styles.safeArea}>
                    {/* Sidebar might still be useful here for logout */}
                    <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color={colors.primary} /></TouchableOpacity>
                        <Text style={styles.headerTitle}>Profile Error</Text>
                        <View style={styles.headerButton} />{/* Placeholder for balance */}
                    </View>
                    <View style={styles.errorContainer}>
                        <MaterialIcons name="error-outline" size={60} color={colors.error} />
                        <Text style={styles.errorText}>Could not load profile.</Text>
                        <Text style={styles.errorSubText}>{popupErrorMessage || "Please check connection or try logging out."}</Text>
                        {/* Keep logout button accessible */}
                        <TouchableOpacity style={styles.logoutButtonError} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
                            <Text style={styles.logoutButtonTextError}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                    {/* Error Popup can still display specific errors like token expiry */}
                    <ErrorPopup
                        visible={isErrorPopupVisible}
                        message={popupErrorMessage}
                        onClose={clearError}
                        colors={colors} // Pass colors object
                    />
                </SafeAreaView>
            </LinearGradient>
        );
    }

    // --- Reusable Inline Components --- (Keep as is)
    const InfoRow: React.FC<{ label: string; value: string | undefined | string[]; iconName: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome' }> =
        ({ label, value, iconName, iconFamily = 'Ionicons' }) => {
            const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
            const displayValue = Array.isArray(value) ? value.join(', ') : value; // Handle array roles
            return (
                <View style={styles.infoRow}>
                    <IconComponent name={iconName} size={20} color={colors.primary} style={styles.infoIcon} />
                    <Text style={styles.infoLabel}>{label}:</Text>
                    <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">{displayValue || 'Not set'}</Text>
                </View>
            );
        };


    // --- Main JSX (Successful Load) ---
    // This should only render if 'user' is guaranteed to be non-null
    // The check `if (!user && !isLoading)` above handles the error case.
    // Adding an explicit check here for safety, though theoretically covered.
    if (!user) return <Loading />; // Or return error view again

    return (
        <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />
                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color={colors.primary} /></TouchableOpacity>
                        <Text style={styles.headerTitle}>Profile</Text>
                        <View style={styles.headerButton} />
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Profile Picture Area */}
                        <View style={styles.profilePicContainer}>
                           <Image
                                style={styles.profilePic}
                                onError={(e) => console.log("Error loading profile pic:", e.nativeEvent.error)} // Add error handling for image
                            />
                        </View>

                        {/* Account Details Section */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Account Details</Text>
                                {!isEditing && (
                                    <TouchableOpacity style={styles.editButtonInline} onPress={() => setIsEditing(true)}>
                                        <FontAwesome name="pencil" size={16} color={colors.primary} />
                                        <Text style={styles.editButtonText}>Edit</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {isEditing ? (
                                // Editing View
                                <View style={styles.editingContainer}>
                                    <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#aaa" value={name} onChangeText={setName} autoCapitalize="words" />
                                    <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#aaa" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
                                    <View style={styles.editActionsContainer}>
                                        <TouchableOpacity style={[styles.editActionButton, styles.cancelButton]} onPress={() => { setIsEditing(false); setName(user.name); setPhone(user.phone); }}>
                                            <Text style={[styles.editActionButtonText, styles.cancelButtonText]}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.editActionButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>
                                            {isSaving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[styles.editActionButtonText, styles.saveButtonText]}>Save Changes</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                // Display View
                                <View style={styles.infoContainer}>
                                    <InfoRow label="Name" value={user.name} iconName="person-outline" />
                                    <InfoRow label="Email" value={user.email} iconName="mail-outline" />
                                    <InfoRow label="Phone" value={user.phone} iconName="call-outline" />
                                    <InfoRow label="Roles" value={user.role} iconName="shield-checkmark-outline" />
                                </View>
                            )}
                        </View>

                        {/* Actions Section */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Actions</Text>
                            {/* Conditional Upgrade Button */}
                            {!(user.role?.includes('driver')) && (
                                <ActionButton title="Upgrade to Driver" onPress={handleUpgradeRole} iconName="rocket-outline" loading={isUpgrading} style={{ marginBottom: 15 }} disabled={isUpgrading} />
                            )}
                            {/* Conditional Manage Taxi Button */}
                            {user.role?.includes('driver') && (
                                <ActionButton title="Manage My Taxis" onPress={() => handleNavigate('TaxiManagement')} iconName="settings-outline" style={{ marginBottom: 15 }} color="#1E88E5" />
                            )}
                            {/* Logout Button */}
                            <ActionButton title="Logout" onPress={handleLogout} iconName="log-out-outline" color={colors.error} style={{ marginBottom: 10 }} />
                        </View>

                        {/* Add Taxi Section (Only for Drivers) */}
                        {user.role?.includes('driver') && (
                            <View style={styles.sectionCard}>
                                <TouchableOpacity style={styles.addTaxiHeader} onPress={() => setIsTaxiFormVisible(!isTaxiFormVisible)}>
                                    <Text style={styles.sectionTitle}>Register New Taxi</Text>
                                    <Ionicons name={isTaxiFormVisible ? "chevron-up" : "chevron-down"} size={24} color={colors.primary} />
                                </TouchableOpacity>
                                {isTaxiFormVisible && (
                                    // Taxi Form
                                    <Animated.View style={styles.taxiFormContainer}>
                                        <TextInput style={styles.input} placeholder="Number Plate *" placeholderTextColor="#aaa" value={numberPlate} onChangeText={setNumberPlate} autoCapitalize="characters" />
                                        <TextInput style={styles.input} placeholder="Capacity *" placeholderTextColor="#aaa" value={capacity} keyboardType="numeric" onChangeText={setCapacity} />
                                        <TextInput style={styles.input} placeholder="Current Stop / Rank *" placeholderTextColor="#aaa" value={currentStop} onChangeText={setCurrentStop} />
                                        <TextInput style={styles.input} placeholder="Primary Route Name *" placeholderTextColor="#aaa" value={routeName} onChangeText={setRouteName} />
                                        <ActionButton title="Register Taxi" onPress={handleAddTaxi} iconName="add-circle-outline" loading={isAddingTaxi} style={{ marginTop: 10 }} disabled={isAddingTaxi} />
                                    </Animated.View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </Animated.View>

                {/* --- Global Error Popup --- */}
                <ErrorPopup
                    visible={isErrorPopupVisible}
                    message={popupErrorMessage}
                    onClose={clearError}
                    colors={colors} // Pass the colors object
                />
            </SafeAreaView>
        </LinearGradient>
    );
};


// --- Styles --- (Keep existing styles, ensure they use the 'colors' object)
const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 25 : 0, // Adjust status bar padding
    },
    mainContainer: {
        flex: 1,
        // Remove marginHorizontal if safeArea handles padding
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        // backgroundColor: colors.white, // Optional: Header background
        borderBottomWidth: 1,
        borderBottomColor: colors.secondary,
    },
    headerButton: {
        padding: 5, // Add padding for easier touch
        minWidth: 40, // Ensure minimum touch area
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.primary,
    },
    scrollContent: {
        paddingHorizontal: 15,
        paddingBottom: 40, // Ensure space at the bottom
    },
    profilePicContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    profilePic: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: colors.primary,
        backgroundColor: colors.secondary, // Placeholder bg
    },
    sectionCard: {
        backgroundColor: colors.white,
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.secondary,
        paddingBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.primary,
    },
    editButtonInline: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 10,
        // backgroundColor: colors.secondary, // Optional background
        borderRadius: 5,
    },
    editButtonText: {
        marginLeft: 5,
        color: colors.primary,
        fontWeight: '500',
    },
    infoContainer: {
        // Container for InfoRows
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoIcon: {
        marginRight: 10,
        width: 20, // Ensure alignment
        textAlign: 'center',
    },
    infoLabel: {
        fontSize: 15,
        color: colors.text,
        fontWeight: '500',
        marginRight: 5,
        minWidth: 60, // Align values
    },
    infoValue: {
        fontSize: 15,
        color: colors.text,
        flexShrink: 1, // Allow text to shrink if needed
    },
    editingContainer: {
        marginTop: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.secondary,
        backgroundColor: '#F8F9FA', // Slightly off-white bg
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 15,
        fontSize: 15,
        marginBottom: 15,
        color: colors.text,
    },
    editActionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // Align buttons to the right
        marginTop: 10,
    },
    editActionButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginLeft: 10,
        flexDirection: 'row', // Allow for icon/indicator
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 80, // Minimum width
    },
    editActionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    cancelButton: {
        backgroundColor: colors.secondary, // Lighter background for cancel
    },
    cancelButtonText: {
        color: colors.text, // Standard text color
    },
    saveButton: {
        backgroundColor: colors.success, // Use success color for save
    },
    saveButtonText: {
        color: colors.white, // White text on success button
    },
    actionButtonBase: { // Base style for ActionButton component
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    actionButtonIcon: {
        marginRight: 8,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    addTaxiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 10, // Add padding if needed
    },
    taxiFormContainer: {
        marginTop: 15, // Space between header and form
        borderTopWidth: 1,
        borderTopColor: colors.secondary,
        paddingTop: 15,
    },
    // Loading Styles
    loadingGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainerInternal: { // Renamed to avoid conflict
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.8)', // Semi-transparent white
        borderRadius: 15,
    },
    loadingTextInternal: { // Renamed to avoid conflict
        marginTop: 15,
        fontSize: 18,
        color: colors.primary,
        fontWeight: '500',
    },
    // Error View Styles
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.error,
        marginTop: 15,
        textAlign: 'center',
    },
    errorSubText: {
        fontSize: 16,
        color: colors.text,
        marginTop: 10,
        textAlign: 'center',
        marginBottom: 20,
    },
    logoutButtonError: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.error,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        marginTop: 20,
    },
    logoutButtonTextError: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
    },
});


export default ProfileScreen;