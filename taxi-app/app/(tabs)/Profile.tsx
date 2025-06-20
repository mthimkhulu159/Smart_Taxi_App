import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    ScrollView,
    Animated,
    SafeAreaView,
    Platform,
    Dimensions,
    ActivityIndicator // Explicitly imported for loading indicators
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { fetchData, getToken } from '../api/api';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/authContext';
import Sidebar from '../components/Sidebar';
import { apiUrl } from '../api/apiUrl';
import { RootStackParamList } from '../types/navigation';
import CustomConfirm from '../components/CustomConfirm';
import AccountDeletionButton from '../components/AccountDeletion';
import { UserProfile } from '../types/userProfile';
import { colors } from '../constants/colors'; // Ensure this points to your updated colors file

// Reusable Components
import Loading from '../components/common/Loading';
import ProfileHeader from '../components/ProfileScreen/ProfileHeader';
import ProfileInfoDisplay from '../components/ProfileScreen/ProfileInfoDisplay';
import ProfileEditForm from '../components/ProfileScreen/ProfileEditForm';
import ProfileActions from '../components/ProfileScreen/ProfileActions';
import AddTaxiForm from '../components/ProfileScreen/AddTaxiForm';
import CustomMessagePopup from '../components/common/CustomMessagePopup'; // Import the new popup

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;

const { height } = Dimensions.get('window');

const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^\d{7,15}$/;
    return phoneRegex.test(phone);
};

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
    const [allowReturnPickups, setAllowReturnPickups] = useState(false);

    // Existing state for inline UI messages
    const [uiMessage, setUiMessage] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const uiMessageTimerRef = useRef<NodeJS.Timeout | null>(null);

    // New state for the CustomMessagePopup
    const [popupMessage, setPopupMessage] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

    const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // Helper function to show UI messages and clear them after a duration
    // Added a `usePopup` parameter to control where the message appears
    const showUiMessage = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', usePopup: boolean = false) => {
        if (usePopup) {
            setPopupMessage({ message, type });
        } else {
            setUiMessage({ message, type });
            if (uiMessageTimerRef.current) {
                clearTimeout(uiMessageTimerRef.current);
            }
            uiMessageTimerRef.current = setTimeout(() => {
                setUiMessage(null);
            }, type === 'success' ? 3000 : 5000); // Success messages disappear faster
        }
    };

    // Helper function to clear UI messages immediately
    const clearUiMessage = () => {
        if (uiMessageTimerRef.current) {
            clearTimeout(uiMessageTimerRef.current);
        }
        setUiMessage(null);
        setPopupMessage(null); // Also clear popup messages
    };

    useEffect(() => {
        const fetchUserProfile = async () => {
            setIsLoading(true);
            clearUiMessage(); // Clear any previous messages
            const token = await getToken();
            if (token) {
                try {
                    const response = await fetchData(apiUrl, 'api/users/get-user', { method: 'GET' });
                    if (response?.user) {
                        setUser(response.user);
                        setName(response.user.name);
                        setPhone(response.user.phone);
                    } else {
                        throw new Error(response?.message || 'Failed to retrieve valid user data.');
                    }
                } catch (error: any) {
                    let displayMessage = "Failed to fetch your profile data. Please try again later.";
                    if (error?.response?.data?.message) {
                        displayMessage = error.response.data.message;
                    } else if (error?.data?.message) {
                        displayMessage = error.data.message;
                    } else if (error?.message) {
                        displayMessage = error.message;
                    }
                    showUiMessage(displayMessage, 'error', true); // Use popup for critical loading errors
                    setUser(null);
                } finally {
                    setIsLoading(false);
                }
            } else {
                showUiMessage('Your session has expired. Please log in again.', 'warning', true); // Use popup for session expiration
                setIsLoading(false);
                setUser(null);
                try {
                    await logout();
                    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                } catch (logoutError: unknown) {
                    console.error("Error during automatic logout:", logoutError);
                    showUiMessage("Session expired. An error also occurred during automatic logout.", 'error', true);
                }
            }
        };
        fetchUserProfile();
        return () => {
            if (uiMessageTimerRef.current) {
                clearTimeout(uiMessageTimerRef.current);
            }
        };
    }, [navigation, logout]);

    useEffect(() => {
        if (!isLoading && user) {
            const animationTimer = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                ]).start();
            }, 100);
            return () => clearTimeout(animationTimer);
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(30);
        }
    }, [isLoading, user, fadeAnim, slideAnim]);

    const handleDeletionStatusUpdate = (isPending: boolean) => {
        if (user) {
            setUser({ ...user, isDeletionRequested: isPending });
        }
    };

    // --- handleSave function refactored to use popup for success/error ---
    const handleSave = async () => {
        if (isSaving) return; // Prevent multiple clicks

        clearUiMessage(); // Clear any existing messages

        // Client-side validation - remain inline for immediate feedback
        if (!name.trim()) {
            showUiMessage('Name cannot be empty.', 'warning');
            return;
        }
        if (!phone.trim()) {
            showUiMessage('Phone number cannot be empty.', 'warning');
            return;
        }
        if (!validatePhoneNumber(phone.trim())) {
            showUiMessage('Please enter a valid phone number format.', 'warning');
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
                    setUser(currentUser => ({
                        ...(currentUser ?? {} as UserProfile),
                        name: response.user.name || currentUser?.name,
                        phone: response.user.phone || currentUser?.phone,
                        email: currentUser?.email ?? response.user.email,
                        role: currentUser?.role ?? response.user.role,
                        _id: currentUser?._id ?? response.user._id,
                        roleUpgradeRequested: currentUser?.roleUpgradeRequested ?? response.user.roleUpgradeRequested,
                        isDeletionRequested: currentUser?.isDeletionRequested ?? response.user.isDeletionRequested,
                    }));
                    setName(response.user.name || name);
                    setPhone(response.user.phone || phone);
                    setIsEditing(false);
                    showUiMessage('Profile updated successfully!', 'success', true); // Use popup for success
                } else {
                    throw new Error(response?.message || 'Update response did not contain valid user data.');
                }
            } catch (error: any) {
                console.error('Error updating profile:', error);
                let displayMessage = "Failed to update profile. Please try again.";

                if (error?.response?.status === 400 && error?.response?.data?.message) {
                    if (error.response.data.message.includes('Phone number already in use')) {
                        displayMessage = 'This phone number is already registered to another account.';
                    } else if (error.response.data.message.includes('invalid phone number format')) {
                        displayMessage = 'The phone number format is invalid.';
                    } else {
                        displayMessage = error.response.data.message;
                    }
                } else if (error?.response?.data) {
                    displayMessage = error.response.data.message || "An error occurred during update.";
                } else if (error?.message) {
                    displayMessage = error.message;
                }
                showUiMessage(displayMessage, 'error', true); // Use popup for error
            } finally {
                setIsSaving(false);
            }
        } else {
            showUiMessage('Cannot save: User data is not available. Please try logging in again.', 'error', true); // Popup for critical user data issue
            setIsSaving(false);
        }
    };

    // --- handleUpgradeRole function refactored ---
    const handleUpgradeRole = async () => {
        clearUiMessage();

        if (user?.roleUpgradeRequested) {
            showUiMessage('Your request for a driver upgrade is already pending approval.', 'info', true); // Popup for pending status
            return;
        }
        if (user?.role?.includes('driver')) {
            showUiMessage('Your account already has driver privileges.', 'info', true); // Popup for already driver
            return;
        }
        if (!user) {
            showUiMessage('User data missing. Cannot upgrade role. Please refresh the screen or log in again.', 'error', true); // Popup for critical user data issue
            return;
        }

        setIsUpgrading(true);

        try {
            console.log("Attempting role upgrade...");
            const response = await fetchData(apiUrl, 'api/users/upgrade-role', { method: 'PUT' });
            console.log("Role upgrade response received:", response);

            if (response?.message) {
                showUiMessage(response.message, 'success', true); // Popup for success
                setUser(prevUser => {
                    if (prevUser) {
                        return { ...prevUser, roleUpgradeRequested: true };
                    }
                    return { roleUpgradeRequested: true } as any; // Fallback if prevUser is null
                });
            } else if (response?.user?.role?.includes('driver')) {
                setUser(response.user);
                showUiMessage('Your account has been upgraded to Driver!', 'success', true); // Popup for direct upgrade
            } else if (response?.error) {
                console.warn("Role upgrade request failed:", response);
                showUiMessage(response.error, 'error', true); // Popup for API error
            } else {
                showUiMessage('Something went wrong while submitting the upgrade request. Please try again.', 'error', true); // Popup for general error
            }
        } catch (error: any) {
            console.error('Error upgrading role:', error);
            let displayMessage = "Failed to submit upgrade request. Please try again or contact support.";

            if (error?.response?.status === 400 && error?.response?.data?.message === 'Your upgrade request is already pending approval') {
                displayMessage = 'Your request for a driver upgrade is already pending approval.';
                setUser(prevUser => {
                    if (prevUser) {
                        return { ...prevUser, roleUpgradeRequested: true };
                    }
                    return { roleUpgradeRequested: true } as any;
                });
            } else if (error?.response?.data?.message) {
                displayMessage = error.response.data.message;
            } else if (error?.data?.message) {
                displayMessage = error.data.message;
            } else if (error?.message) {
                displayMessage = error.message;
            }
            showUiMessage(displayMessage, 'error', true); // Popup for network/server error
        } finally {
            setIsUpgrading(false);
        }
    };

    const handleLogout = () => {
        setIsLogoutConfirmVisible(true);
    };

    const confirmLogout = async () => {
        setIsLogoutConfirmVisible(false);
        clearUiMessage();
        try {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        } catch (error: unknown) {
            console.error("Error during logout:", error);
            showUiMessage("An unexpected error occurred during logout.", 'error', true); // Popup for logout error
        }
    };

    const cancelLogout = () => {
        setIsLogoutConfirmVisible(false);
    };

    // --- handleAddTaxi function refactored ---
    const handleAddTaxi = async () => {
        clearUiMessage();

        // Client-side validation - remain inline for immediate feedback
        if (!numberPlate.trim() || !capacity.trim() || !routeName.trim() || !currentStop.trim()) {
            showUiMessage('Please fill in all required taxi details (Number Plate, Capacity, Route, Current Stop).', 'warning');
            return;
        }

        const parsedCapacity = parseInt(capacity, 10);
        if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
            showUiMessage('Please enter a valid positive number for capacity.', 'warning');
            return;
        }

        setIsAddingTaxi(true);

        try {
            const body = {
                numberPlate: numberPlate.trim().toUpperCase(),
                routeName: routeName.trim(),
                capacity: parsedCapacity,
                currentStop: currentStop.trim(),
                allowReturnPickups: allowReturnPickups || false,
            };

            console.log("Adding taxi with data:", body);

            const response = await fetchData(apiUrl, 'api/taxis/addTaxi', {
                method: 'POST',
                body: body,
            });

            if (response?.taxi?._id) {
                showUiMessage(`Taxi ${response.taxi.numberPlate} added successfully!`, 'success', true); // Popup for success
                setNumberPlate('');
                setCapacity('');
                setCurrentStop('');
                setRouteName('');
                setAllowReturnPickups(false);
                setIsTaxiFormVisible(false);
            } else {
                throw new Error(response?.message || 'Failed to add taxi. Response format incorrect.');
            }
        } catch (error: any) {
            console.error('Error adding taxi:', error);
            let displayMessage = "Failed to add taxi. Please try again.";

            if (error?.response?.data?.message) {
                displayMessage = error.response.data.message;
            } else if (error?.data?.message) {
                displayMessage = error.data.message;
            } else if (error?.message) {
                displayMessage = error.message;
            }

            if (displayMessage.includes('duplicate key error') && displayMessage.includes('numberPlate')) {
                displayMessage = `A taxi with number plate ${numberPlate.trim().toUpperCase()} already exists.`;
            }
            showUiMessage(displayMessage, 'error', true); // Popup for error
        } finally {
            setIsAddingTaxi(false);
        }
    };

    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false);
        if (screen === 'Auth') {
            handleLogout();
        } else {
            navigation.navigate({ name: screen, params: undefined, merge: true } as any);
        }
    };

    const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

    if (isLoading) {
        return <Loading />;
    }

    if (!user && !isLoading) {
        return (
            <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.gradient}>
                <SafeAreaView style={styles.safeArea}>
                    <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />
                    <ProfileHeader onToggleSidebar={toggleSidebar} />
                    <View style={styles.errorContainer}>
                        <MaterialIcons name="error-outline" size={60} color={colors.error} />
                        <Text style={styles.errorText}>Could not load profile.</Text>
                        {/* Only show general messages here, popups handle specific errors */}
                        <Text style={styles.errorSubText}>Please check your connection or try logging out.</Text>
                        <TouchableOpacity style={styles.logoutButtonError} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
                            <Text style={styles.logoutButtonTextError}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
                {/* Always render popup at the root of the screen, outside scrollviews etc. */}
                {popupMessage && (
                    <CustomMessagePopup
                        visible={!!popupMessage}
                        message={popupMessage.message}
                        type={popupMessage.type}
                        onClose={() => setPopupMessage(null)}
                        duration={popupMessage.type === 'success' ? 3000 : 5000}
                    />
                )}
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />
                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <ProfileHeader onToggleSidebar={toggleSidebar} />

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.profilePicContainer}>
                            <Image
                                style={styles.profilePic}
                                onError={(e) => console.log("Error loading profile pic:", e.nativeEvent.error)}
                            />
                        </View>

                        {/* Display INLINE UI message */}
                        {uiMessage && (
                            <View style={[styles.messageContainer, { backgroundColor: uiMessage.type === 'error' ? colors.errorLight : uiMessage.type === 'success' ? colors.successLight : uiMessage.type === 'warning' ? colors.warningLight : colors.infoLight }]}>
                                <Text style={[styles.messageText, { color: uiMessage.type === 'error' ? colors.error : uiMessage.type === 'success' ? colors.success : uiMessage.type === 'warning' ? colors.warning : colors.info }]}>
                                    {uiMessage.message}
                                </Text>
                            </View>
                        )}

                        {isEditing ? (
                            <ProfileEditForm
                                name={name}
                                setName={setName}
                                phone={phone}
                                setPhone={setPhone}
                                onSave={handleSave}
                                onCancel={() => {
                                    setIsEditing(false);
                                    clearUiMessage(); // Clear messages when canceling edit
                                    if (user) {
                                        setName(user.name);
                                        setPhone(user.phone);
                                    }
                                }}
                                isSaving={isSaving}
                            />
                        ) : (
                            user && <ProfileInfoDisplay user={user} onEditPress={() => setIsEditing(true)} />
                        )}

                        <ProfileActions
                            isDriver={user?.role?.includes('driver') ?? false}
                            isUpgradePending={user?.roleUpgradeRequested ?? false}
                            onUpgradeRole={handleUpgradeRole}
                            isUpgrading={isUpgrading}
                            onManageTaxis={() => handleNavigate('TaxiManagement')}
                            onLogout={handleLogout}
                            onDeletionStatusChange={handleDeletionStatusUpdate}
                            initialDeletionStatus={user?.isDeletionRequested ?? false}
                        />

                        {user?.role?.includes('driver') && (
                            <AddTaxiForm
                                isTaxiFormVisible={isTaxiFormVisible}
                                onToggleVisibility={() => {
                                    setIsTaxiFormVisible(!isTaxiFormVisible);
                                    clearUiMessage(); // Clear messages when toggling taxi form
                                }}
                                numberPlate={numberPlate}
                                setNumberPlate={setNumberPlate}
                                capacity={capacity}
                                setCapacity={setCapacity}
                                currentStop={currentStop}
                                setCurrentStop={setCurrentStop}
                                routeName={routeName}
                                setRouteName={setRouteName}
                                allowReturnPickups={allowReturnPickups}
                                setAllowReturnPickups={setAllowReturnPickups}
                                onAddTaxi={handleAddTaxi}
                                isAddingTaxi={isAddingTaxi}
                            />
                        )}
                    </ScrollView>
                </Animated.View>

                <CustomConfirm
                    visible={isLogoutConfirmVisible}
                    message="Are you sure you want to log out?"
                    onCancel={cancelLogout}
                    onConfirm={confirmLogout}
                />

                {/* Always render popup at the root of the screen, outside scrollviews etc. */}
                {popupMessage && (
                    <CustomMessagePopup
                        visible={!!popupMessage}
                        message={popupMessage.message}
                        type={popupMessage.type}
                        onClose={() => setPopupMessage(null)}
                        duration={popupMessage.type === 'success' ? 3000 : 5000} // Dynamic duration
                    />
                )}
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 25 : 0 },
    mainContainer: { flex: 1 },
    scrollContent: { padding: 20 },
    profilePicContainer: { alignItems: 'center', marginBottom: 20 },
    profilePic: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.secondary },
    // Styles for error state (when user is null after loading)
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
        marginTop: 10,
        textAlign: 'center',
    },
    errorSubText: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: 5,
        textAlign: 'center',
        marginBottom: 20,
    },
    logoutButtonError: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.error,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    logoutButtonTextError: {
        color: colors.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    // Styles for INLINE messages
    messageContainer: {
        padding: 10,
        borderRadius: 8,
        marginBottom: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        // The color will be set dynamically based on `uiMessage.type` in the component
    },
    messageText: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
});

export default ProfileScreen;