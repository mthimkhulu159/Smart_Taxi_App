import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    TextInput,
    ScrollView,
    Animated,
    SafeAreaView,
    Platform,
    Dimensions,
    ActivityIndicator,
    ViewStyle,
    Modal, // Keep for other modals if needed
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from "@expo/vector-icons"; // Keep if used elsewhere
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { fetchData, getToken } from '../api/api'; // Keep
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/authContext';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';
import { RootStackParamList } from '../types/navigation';
// import ErrorPopup from '../components/ErrorPopup'; // Removed ErrorPopup import
import CustomConfirm from '../components/CustomConfirm'; // Import the CustomConfirm component
import CustomPopup from '../components/CustomPopup'; // Import the new CustomPopup component
// --- Constants ---
const { width: windowWidth } = Dimensions.get('window');

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
    textLight: "#FFF", // Used in ErrorPopup text (might not be needed now)
    placeholder: "#A0A0A0",
    white: "#FFFFFF",
    error: "#D32F2F", // Used in ErrorPopup icon (might need adjustment)
    success: "#28A745",
    // Added from AuthScreen for ErrorPopup styling consistency (might not be needed now)
    background: '#29335C', // Background for the popup modal view
    primaryAccent: '#007AFF', // Button color for the popup
    buttonText: '#FFFFFF', // Text color for the popup button
};


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

    // --- State for Custom Popup ---
    const [isPopupVisible, setIsPopupVisible] = useState(false);
    const [popupMessage, setPopupMessage] = useState<string>('');
    const [popupType, setPopupType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
    const [popupDetailedMessage, setPopupDetailedMessage] = useState<string | undefined>(undefined);
    const [popupOnRetry, setPopupOnRetry] = useState<(() => void) | undefined>(undefined);

    // --- State for Custom Confirm ---
    const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // --- Helper function to show the custom popup ---
    const showPopup = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', detailedMessage?: string, onRetry?: () => void) => {
        setPopupMessage(message);
        setPopupType(type);
        setPopupDetailedMessage(detailedMessage);
        setPopupOnRetry(onRetry);
        setIsPopupVisible(true);
    };

    // --- Helper function to close the custom popup ---
    const closePopup = () => {
        setIsPopupVisible(false);
        setPopupDetailedMessage(undefined);
        setPopupOnRetry(undefined);
        // Optionally clear message after fade out animation if needed
        // setPopupMessage('');
    };

    // --- Effects ---
    useEffect(() => {
        const fetchUserProfile = async () => {
            setIsLoading(true);
            // Reset previous errors when fetching
            closePopup();
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
                    let detailedErrorMessage: string | undefined;
                    if (error?.response?.data?.message) {
                        displayMessage = error.response.data.message;
                        detailedErrorMessage = JSON.stringify(error.response.data);
                    } else if (error?.data?.message) {
                         displayMessage = error.data.message;
                         detailedErrorMessage = JSON.stringify(error.data);
                    } else if (error?.message) {
                         displayMessage = error.message;
                         detailedErrorMessage = error.message;
                    }
                    showPopup(displayMessage, 'error', detailedErrorMessage);
                    setUser(null); // Clear user data on error
                } finally {
                    setIsLoading(false);
                }
            } else {
                // Handle missing token case
                showPopup('Your session has expired. Please log in again.', 'warning');
                setIsLoading(false);
                setUser(null);
                try {
                    await logout();
                    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                } catch (logoutError: unknown) {
                    console.error("Error during automatic logout:", logoutError);
                    // Show additional error for logout failure if needed
                    showPopup("Session expired. An error also occurred during automatic logout.", 'error', (logoutError as Error)?.message);
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
        // Client-side validation using showPopup
        if (!name.trim() || !phone.trim()) {
            showPopup('Name and phone cannot be empty.', 'warning');
            return;
        }
        setIsSaving(true);
        closePopup(); // Close any previous popups
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
                    // Use showPopup for success message
                    showPopup('Profile updated successfully!', 'success');
                } else {
                    throw new Error(response?.message || 'Update response did not contain user data.');
                }
            } catch (error: any) {
                console.error('Error updating profile:', error);
                let displayMessage = "Failed to update profile. Please try again.";
                let detailedErrorMessage: string | undefined;
                if (error?.response?.data?.message) {
                    displayMessage = error.response.data.message;
                    detailedErrorMessage = JSON.stringify(error.response.data);
                } else if (error?.data?.message) {
                     displayMessage = error.data.message;
                     detailedErrorMessage = JSON.stringify(error.data);
                } else if (error?.message) {
                     displayMessage = error.message;
                     detailedErrorMessage = error.message;
                }
                showPopup(displayMessage, 'error', detailedErrorMessage, handleSave); // Pass handleSave for retry
            } finally {
                 setIsSaving(false);
            }
        } else {
            showPopup('Cannot save: User data is not available.', 'error');
            setIsSaving(false); // Ensure loading state is reset
        }
    };
    const handleUpgradeRole = async () => {
        closePopup(); // Close any previous popups
        // Validation checks
        if (user?.role?.includes('driver')) {
          showPopup('Your account already has driver privileges.', 'info');
          return;
        }
        if (!user) {
          showPopup('User data missing. Cannot upgrade role.', 'error');
          return;
        }

        setIsUpgrading(true);

        try {
          console.log("Attempting role upgrade...");
          const response = await fetchData(apiUrl, 'api/users/upgrade-role', { method: 'PUT' });
          console.log("Role upgrade response received:", response);

          // Handle successful submission of the upgrade request
          if (response?.message) {
            showPopup(response.message, 'success'); // e.g., "Your request for an upgrade to driver has been sent for approval"
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
            showPopup('Your account has been upgraded to Driver!', 'success');
          }
          // Handle unexpected error or no message in the success response
          else if (response?.error) {
            console.warn("Role upgrade request failed:", response);
            showPopup(response.error, 'error', response.error, handleUpgradeRole);
          }
          // Handle other unexpected scenarios
          else {
            console.warn("Unexpected response format for role upgrade:", response);
            showPopup('Something went wrong while submitting the upgrade request.', 'error', JSON.stringify(response), handleUpgradeRole);
          }
        } catch (error: any) {
          console.error('Error upgrading role:', error);
          let displayMessage = "Failed to submit upgrade request. Please try again or contact support.";
          let detailedErrorMessage: string | undefined;
          if (error?.response?.data?.message) {
            displayMessage = error.response.data.message;
            detailedErrorMessage = JSON.stringify(error.response.data);
          } else if (error?.data?.message) {
            displayMessage = error.data.message;
            detailedErrorMessage = JSON.stringify(error.data);
          } else if (error?.message) {
            displayMessage = error.message;
            detailedErrorMessage = error.message;
          }
          showPopup(displayMessage, 'error', detailedErrorMessage, handleUpgradeRole);
        } finally {
          setIsUpgrading(false);
        }
      };

    const handleLogout = () => {
        // Show the custom confirm modal
        setIsLogoutConfirmVisible(true);
    };

    const confirmLogout = async () => {
        setIsLogoutConfirmVisible(false);
        closePopup(); // Close any previous popups
        try {
            await logout(); // Call the logout function from context
            // Navigate to Auth screen after successful logout
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        } catch (error: unknown) {
            console.error("Error during logout process:", error);
            // Use showPopup for errors *during* the logout API call or cleanup
            showPopup("An unexpected error occurred during logout.", 'error', (error as Error)?.message);
        }
    };

    const cancelLogout = () => {
        setIsLogoutConfirmVisible(false);
    };

    // --- Taxi Registration Handler ---
    const handleAddTaxi = async () => {
        closePopup(); // Close any previous popups

        // Client-side validation using showPopup
        if (!numberPlate.trim() || !capacity.trim() || !routeName.trim() || !currentStop.trim()) {
            showPopup('Please fill in all required taxi details (Number Plate, Capacity, Route, Current Stop).', 'warning');
            return;
        }
        const parsedCapacity = parseInt(capacity, 10);
        if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
            showPopup('Please enter a valid positive number for capacity.', 'warning');
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
                showPopup(`Taxi ${response.taxi.numberPlate} added successfully!`, 'success');
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
            let detailedErrorMessage: string | undefined;
            if (error?.response?.data?.message) { // Check for specific backend message
                displayMessage = error.response.data.message;
                detailedErrorMessage = JSON.stringify(error.response.data);
            } else if (error?.data?.message) {
                 displayMessage = error.data.message;
                 detailedErrorMessage = JSON.stringify(error.data);
            } else if (error?.message) {
                 displayMessage = error.message; // Fallback to generic error message
                 detailedErrorMessage = error.message;
            }
            // Handle specific common errors if needed
            if (displayMessage.includes('duplicate key error') && displayMessage.includes('numberPlate')) {
                displayMessage = `A taxi with number plate ${numberPlate.trim().toUpperCase()} already exists.`;
            }
            showPopup(displayMessage, 'error', detailedErrorMessage, handleAddTaxi);
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
                        <Text style={styles.errorSubText}>{popupMessage || "Please check connection or try logging out."}</Text>
                        {/* Keep logout button accessible */}
                        <TouchableOpacity style={styles.logoutButtonError} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
                            <Text style={styles.logoutButtonTextError}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                    {/* Custom Popup for displaying errors/info */}
                    <CustomPopup
                        visible={isPopupVisible}
                        message={popupMessage}
                        type={popupType}
                        detailedMessage={popupDetailedMessage}
                        onClose={closePopup}
                        onRetry={popupOnRetry}
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
                                            <Text style={[styles.cancelButtonText]}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.editActionButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>
                                            {isSaving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[styles.saveButtonText]}>Save Changes</Text>}
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

                {/* --- Custom Popup Component --- */}
                <CustomPopup
                    visible={isPopupVisible}
                    message={popupMessage}
                    type={popupType}
                    detailedMessage={popupDetailedMessage}
                    onClose={closePopup}
                    onRetry={popupOnRetry}
                />

                {/* --- Custom Confirm Component --- */}
                <CustomConfirm
                    visible={isLogoutConfirmVisible}
                    message="Are you sure you want to log out?"
                    onCancel={cancelLogout}
                    onConfirm={confirmLogout}
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
    headerTitle: {
        fontSize: 22,
        color: colors.primary,
        fontWeight: 'bold',
    },
    headerButton: {
        padding: 8,
    },
    scrollContent: {
        padding: 20,
    },
    profilePicContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    profilePic: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.secondary, // Placeholder background
    },
    sectionCard: {
        backgroundColor: colors.white,
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    editButtonInline: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.secondary,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 5,
    },
    editButtonText: {
        marginLeft: 5,
        color: colors.primary,
        fontSize: 16,
    },
    infoContainer: {
        // Styles for displaying user info
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    infoIcon: {
        marginRight: 10,
        width: 20, // Adjust width to prevent text overlap
        alignItems: 'center', // Center the icon within its space
    },
    infoLabel: {
        fontWeight: 'bold',
        color: colors.text,
        marginRight: 5,
        flexShrink: 0, // Prevent label from shrinking too much
    },
    infoValue: {
        color: colors.text,
        flexShrink: 1, // Allow value to shrink and wrap
    },
    editingContainer: {
        marginVertical: 10,
    },
    input: {
        backgroundColor: colors.secondary,
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
        color: colors.text,
    },
    editActionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    editActionButton: {
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 5,
        marginLeft: 10,
    },
    cancelButton: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    cancelButtonText: {
        color: colors.primary,
    },
    saveButton: {
        backgroundColor: colors.primary,
    },
    saveButtonText: {
        color: colors.white,
    },
    actionButtonBase: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
    },
    actionButtonIcon: {
        marginRight: 8,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainerInternal: {
        alignItems: 'center',
    },
    loadingTextInternal: {
        marginTop: 10,
        fontSize: 16,
        color: colors.primary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.error,
        marginTop: 20,
        textAlign: 'center',
    },
    errorSubText: {
        fontSize: 16,
        color: colors.text,
        marginTop: 10,
        textAlign: 'center',
    },
    logoutButtonError: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.error,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 20,
    },
    logoutButtonTextError: {
        color: colors.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    addTaxiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    taxiFormContainer: {
        marginTop: 15,
    },
});

export default ProfileScreen;