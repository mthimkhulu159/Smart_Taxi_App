import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    TextInput,
    Alert, // Will be replaced by ErrorPopup
    ScrollView,
    Animated,
    SafeAreaView,
    Platform,
    Dimensions,
    ActivityIndicator,
    Button, // Added temporarily for testing if needed
    ViewStyle,
    Modal, // Import Modal for ErrorPopup
} from 'react-native'; // Added Button for testing
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from "@expo/vector-icons";
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons'; // Removed AntDesign if not used
import { fetchData, getToken } from '../api/api'; // Removed removeToken as it's used via context
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/authContext';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';

// --- Constants ---

const { width: windowWidth } = Dimensions.get('window');

// --- Navigation Types ---
type RootStackParamList = {
    Home: { acceptedTaxiId?: string };
    requestRide: undefined;
    ViewTaxi: undefined
    ViewRequests: undefined;
    LiveChat: undefined;
    TaxiManagement: undefined;
    Profile: undefined;
    AcceptedRequest: undefined;
    AcceptedPassenger: undefined;
    ViewRoute: undefined;
    Auth: undefined;
    TaxiFareCalculator: undefined
};

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;

// --- Interfaces ---
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

// --- Color Palette ---
const colors = {
    primary: "#003E7E", // Adjusted to match your theme
    secondary: "#F0F2F5",
    backgroundGradientStart: "#FFFFFF", // Adjusted to match your theme
    backgroundGradientEnd: "#E8F0FE", // Adjusted to match your theme
    text: "#333",
    textLight: "#FFF",
    placeholder: "#A0A0A0",
    white: "#FFFFFF",
    error: "#D32F2F", // Adjusted to match your theme
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

// --- Loading Component ---
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

// --- ActionButton Component (with added console log) ---
const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
    ({ onPress, title, iconName, iconFamily = 'Ionicons', color = colors.primary, textColor = colors.white, loading = false, style = {}, disabled = false }) => {
        const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
        const isDisabled = disabled || loading;

        // *** DEBUGGING: Wrapper function to log before calling original onPress ***
        const handlePress = () => {
            console.log(`--- ActionButton onPress triggered for: ${title} ---`); // <--- LOG ADDED HERE
            if (onPress) {
                onPress(); // Call the original onPress passed in props
            }
        };

        return (
            <TouchableOpacity
                style={[styles.actionButtonBase, { backgroundColor: color, opacity: isDisabled ? 0.6 : 1 }, style]}
                onPress={handlePress} // <-- Use the wrapper function
                disabled={isDisabled}
                activeOpacity={0.7} // Standard opacity feedback
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
    const [isErrorPopupVisible, setIsErrorPopupVisible] = useState(false);
    const [popupErrorMessage, setPopupErrorMessage] = useState<string>('');

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const showError = (message: string) => {
        setPopupErrorMessage(message);
        setIsErrorPopupVisible(true);
    };

    const clearError = () => {
        setIsErrorPopupVisible(false);
        setPopupErrorMessage('');
    };

    // --- Effects ---
    useEffect(() => {
        const fetchUserProfile = async () => {
            setIsLoading(true);
            const token = await getToken();
            if (token) {
                try {
                    const response = await fetchData(apiUrl, 'api/users/get-user', { method: 'GET' });
                    if (response?.user) {
                        setUser(response.user);
                        setName(response.user.name);
                        setPhone(response.user.phone);
                    } else {
                        throw new Error('Failed to retrieve user data.');
                    }
                } catch (error: any) {
                    console.error('Error fetching user profile:', error?.message);
                    showError(error?.message || 'Failed to fetch your profile data. Please try again later.');
                    setUser(null);
                } finally {
                    setIsLoading(false);
                }
            } else {
                showError('Your session has expired. Please log in again.');
                setIsLoading(false);
                setUser(null);
                try {
                    await logout();
                    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                } catch (logoutError) {
                    console.error("Error during automatic logout:", logoutError);
                    showError("An error occurred during logout. Please try again.");
                }
            }
        };
        fetchUserProfile();
    }, [navigation, logout]); // Added logout as dependency

    useEffect(() => {
        if (!isLoading) {
            const animationTimer = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                ]).start();
            }, 100);
            return () => clearTimeout(animationTimer);
        }
    }, [isLoading, fadeAnim, slideAnim]);

    // --- Handlers ---

    const handleSave = async () => {
        if (!name.trim() || !phone.trim()) {
            showError('Name and phone cannot be empty.');
            return;
        }
        setIsSaving(true);
        if (user) {
            try {
                const response = await fetchData(apiUrl, 'api/users/update-details', {
                    method: 'PUT',
                    body: { name: name.trim(), phone: phone.trim() },
                });

                if (response?.user) {
                    setUser(currentUser => {
                        if (!currentUser) return response.user;
                        return {
                            ...currentUser,
                            name: response.user.name || currentUser.name,
                            phone: response.user.phone || currentUser.phone,
                        };
                    });
                    setName(response.user.name || name);
                    setPhone(response.user.phone || phone);
                    setIsEditing(false);
                    showError('Profile updated successfully!'); // Using ErrorPopup for success message as per requirement
                } else {
                    throw new Error('Failed to update profile data.');
                }
            } catch (error: any) {
                console.error('Error updating profile:', error?.message);
                showError(`Failed to update profile. ${error?.message || 'Please try again.'}`);
            }
        } else {
            showError('Current user data missing. Cannot save.');
        }
        setIsSaving(false);
    };

    const handleUpgradeRole = async () => {
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
            console.log("Attempting role upgrade..."); // Added log
            const response = await fetchData(apiUrl, 'api/users/upgrade-role', {
                method: 'PUT',
            });

            console.log("Role upgrade response received:", response); // Added log

            if (response?.success === true && response?.message) {
                showError(response.message);
            } else if (response?.user && response.user.role?.includes('driver')) {
                setUser(response.user);
                showError('Your account has been upgraded to Driver!');
            } else {
                const errorMessage = response?.message || response?.error || 'Role upgrade failed or confirmation not received.';
                console.warn("Role upgrade failed or response format unexpected:", response); // Log for debugging
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            console.error('Error upgrading role:', error); // Log the full error
            showError(`Failed to submit upgrade request. ${error?.message || 'Please try again or contact support.'}`);
        } finally {
            setIsUpgrading(false);
        }
    };

    const handleLogout = async () => {
        console.log('--- handleLogout function started ---'); // <--- LOG ADDED HERE
        Alert.alert(
            "Confirm Logout",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel", onPress: () => console.log("Logout cancelled") }, // Optional log
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        console.log('--- Alert Logout button pressed ---'); // <--- LOG ADDED HERE
                        try {
                            await logout(); // Call the logout function from context
                            console.log('--- logout() from context finished ---'); // <--- LOG ADDED HERE

                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Auth' }],
                            });
                            console.log('--- navigation.reset finished ---'); // <--- LOG ADDED HERE

                        } catch (error) {
                            console.error("Error during logout process:", error); // <--- LOG ADDED HERE
                            showError("An unexpected error occurred during logout.");
                        }
                    }
                }
            ],
            { cancelable: true } // Allow dismissing alert by tapping outside
        );
    };

    const handleAddTaxi = async () => {
        if (!numberPlate.trim() || !capacity.trim() || !routeName.trim() || !currentStop.trim()) {
            showError('Please fill in all taxi details.');
            return;
        }
        const parsedCapacity = parseInt(capacity, 10);
        if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
            showError('Please enter a valid positive number for capacity.');
            return;
        }
        setIsAddingTaxi(true);
        try {
            const response = await fetchData(apiUrl, 'api/taxis/addTaxi', { method: 'POST', body: { numberPlate: numberPlate.trim(), routeName: routeName.trim(), capacity: parsedCapacity, currentStop: currentStop.trim(), }, });
            if (response?.taxi) {
                showError(`Taxi ${response.taxi.numberPlate} added successfully!`);
                setNumberPlate(''); setCapacity(''); setCurrentStop(''); setRouteName(''); setIsTaxiFormVisible(false);
            } else {
                throw new Error(response?.message || 'Failed to add taxi.');
            }
        } catch (error: any) {
            console.error('Error adding taxi:', error?.message);
            showError(`Failed to add taxi. ${error?.message || 'Please try again.'}`);
        }
        setIsAddingTaxi(false);
    };

    // --- Navigation Handlers ---
    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false);
        if (screen === 'Auth') {
            handleLogout(); // Use consistent logout logic
        } else if (screen === 'Profile') {
            // Already on Profile, just close sidebar
        } else {
            navigation.navigate({ name: screen, params: undefined, merge: true } as any);
        }
    };

    const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

    // --- Render Logic ---
    if (isLoading) { return <Loading />; }

    if (!user && !isLoading) {
        return (
            <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.gradient}>
                <SafeAreaView style={styles.safeArea}>
                    <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color={colors.primary} /></TouchableOpacity>
                        <Text style={styles.headerTitle}>Profile Error</Text>
                        <View style={styles.headerButton} />
                    </View>
                    <View style={styles.errorContainer}>
                        <MaterialIcons name="error-outline" size={60} color={colors.error} />
                        <Text style={styles.errorText}>Could not load profile.</Text>
                        <Text style={styles.errorSubText}>Please check your connection or try logging out.</Text>
                        <TouchableOpacity style={styles.logoutButtonError} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
                            <Text style={styles.logoutButtonTextError}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
                <ErrorPopup
                    visible={isErrorPopupVisible}
                    message={popupErrorMessage}
                    onClose={clearError}
                    colors={colors}
                />
            </LinearGradient>
        );
    }

    // --- Reusable Inline Components ---
    const InfoRow: React.FC<{ label: string; value: string | undefined; iconName: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome' }> =
        ({ label, value, iconName, iconFamily = 'Ionicons' }) => {
            const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
            return (
                <View style={styles.infoRow}>
                    <IconComponent name={iconName} size={20} color={colors.primary} style={styles.infoIcon} />
                    <Text style={styles.infoLabel}>{label}:</Text>
                    <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">{value || 'Not set'}</Text>
                </View>
            );
        };


    // --- Main JSX (Successful Load) ---
    if (!user) return <Loading />; // Or return error view again

    return (
        <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />
                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
                        <View style={styles.profilePicContainer}>
                            <Image
                                style={styles.profilePic}
                                // Assuming the placeholder path issue was resolved separately or assets folder is in root
                            />
                        </View>
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
                                <View style={styles.editingContainer}>
                                    <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#aaa" value={name} onChangeText={setName} autoCapitalize="words" />
                                    <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#aaa" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
                                    <View style={styles.editActionsContainer}>
                                        <TouchableOpacity style={[styles.editActionButton, styles.cancelButton]} onPress={() => { setIsEditing(false); setName(user?.name || ''); setPhone(user?.phone || ''); }}>
                                            <Text style={[styles.editActionButtonText, styles.cancelButtonText]}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.editActionButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>
                                            {isSaving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[styles.editActionButtonText, styles.saveButtonText]}>Save Changes</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.infoContainer}>
                                    {user && ( // Render only if user exists
                                        <>
                                            <InfoRow label="Name" value={user.name} iconName="person-outline" />
                                            <InfoRow label="Email" value={user.email} iconName="mail-outline" />
                                            <InfoRow label="Phone" value={user.phone} iconName="call-outline" />
                                            <InfoRow label="Roles" value={user.role?.join(', ')} iconName="shield-checkmark-outline" />
                                        </>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Actions Section */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Actions</Text>
                            {!(user?.role?.includes('driver')) && (
                                <ActionButton title="Upgrade to Driver" onPress={handleUpgradeRole} iconName="rocket-outline" loading={isUpgrading} style={{ marginBottom: 15 }} disabled={isUpgrading} />
                            )}
                            {user?.role?.includes('driver') && (
                                <ActionButton title="Manage My Taxi" onPress={() => handleNavigate('TaxiManagement')} iconName="settings-outline" style={{ marginBottom: 15 }} color="#1E88E5" />
                            )}

                            {/* --- LOGOUT BUTTON --- */}
                            <ActionButton title="Logout" onPress={handleLogout} iconName="log-out-outline" color={colors.error} style={{ marginBottom: 10 }} />
                            {/* --- END LOGOUT BUTTON --- */}

                            {/* --- Optional Standard Button Test --- */}
                            {/* <Button title="STANDARD LOGOUT TEST" onPress={handleLogout} color="#FF00FF"/> */}
                            {/* --- End Optional Standard Button Test --- */}

                        </View>

                        {/* Add Taxi Section */}
                        {user?.role?.includes('driver') && (
                            <View style={styles.sectionCard}>
                                <TouchableOpacity style={styles.addTaxiHeader} onPress={() => setIsTaxiFormVisible(!isTaxiFormVisible)}>
                                    <Text style={styles.sectionTitle}>Register New Taxi</Text>
                                    <Ionicons name={isTaxiFormVisible ? "chevron-up" : "chevron-down"} size={24} color={colors.primary} />
                                </TouchableOpacity>
                                {isTaxiFormVisible && (
                                    <Animated.View style={styles.taxiFormContainer}>
                                        <TextInput style={styles.input} placeholder="Number Plate" placeholderTextColor="#aaa" value={numberPlate} onChangeText={setNumberPlate} autoCapitalize="characters" />
                                        <TextInput style={styles.input} placeholder="Capacity" placeholderTextColor="#aaa" value={capacity} keyboardType="numeric" onChangeText={setCapacity} />
                                        <TextInput style={styles.input} placeholder="Current Stop / Rank" placeholderTextColor="#aaa" value={currentStop} onChangeText={setCurrentStop} />
                                        <TextInput style={styles.input} placeholder="Primary Route Name" placeholderTextColor="#aaa" value={routeName} onChangeText={setRouteName} />
                                        <ActionButton title="Register Taxi" onPress={handleAddTaxi} iconName="add-circle-outline" loading={isAddingTaxi} style={{ marginTop: 10 }} disabled={isAddingTaxi} />
                                    </Animated.View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </Animated.View>
                <ErrorPopup
                    visible={isErrorPopupVisible}
                    message={popupErrorMessage}
                    onClose={clearError}
                    colors={colors}
                />
            </SafeAreaView>
        </LinearGradient>
    );
};

// --- Styles --- (Assume styles are correct as provided previously)
const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    mainContainer: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%', },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
    profilePicContainer: { alignItems: 'center', marginBottom: 20 },
    profilePic: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#003E7E', backgroundColor: '#E0EFFF' },
    sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#E0E0E0', elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333333' },
    editButtonInline: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 15, backgroundColor: '#E8F0FE' },
    editButtonText: { marginLeft: 5, color: '#003E7E', fontWeight: '500', fontSize: 14 },
    infoContainer: {},
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
    infoIcon: { marginRight: 12, width: 20, textAlign: 'center' },
    infoLabel: { fontSize: 15, color: '#555555', fontWeight: '500', width: 70 },
    infoValue: { fontSize: 15, color: '#000000', fontWeight: '600', flex: 1 },
    editingContainer: { marginTop: 10 },
    input: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 8, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 15 : 12, fontSize: 16, color: '#000000', marginBottom: 15 },
    editActionsContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
    editActionButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginLeft: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    editActionButtonText: { fontWeight: 'bold', fontSize: 15 },
    cancelButton: { backgroundColor: '#EEEEEE' },
    cancelButtonText: { color: '#333333' },
    saveButton: { backgroundColor: '#003E7E' },
    saveButtonText: { color: '#FFFFFF' },
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600' },
    addTaxiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, paddingVertical: 5 },
    taxiFormContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#EEEEEE' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: 'transparent' },
    errorText: { fontSize: 20, fontWeight: 'bold', color: '#D32F2F', textAlign: 'center', marginTop: 15 },
    errorSubText: { fontSize: 16, color: '#555555', textAlign: 'center', marginTop: 10, marginBottom: 20 },
    logoutButtonError: { marginTop: 20, backgroundColor: '#D32F2F', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    logoutButtonTextError: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    loadingGradient: { flex: 1 },
    loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
});

export default ProfileScreen;