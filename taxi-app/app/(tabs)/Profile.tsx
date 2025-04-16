import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ScrollView,
  Animated,
  SafeAreaView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Button, // Added temporarily for testing if needed
  ViewStyle
} from 'react-native'; // Added Button for testing
import { LinearGradient } from 'expo-linear-gradient';
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

// --- ActionButton Component (with added console log) ---
const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
   ({ onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E', textColor = '#FFFFFF', loading = false, style = {}, disabled = false }) => {
      const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
      const isDisabled = disabled || loading;

      // *** DEBUGGING: Wrapper function to log before calling original onPress ***
      const handlePress = () => {
        console.log(`--- ActionButton onPress triggered for: ${title} ---`); // <--- LOG ADDED HERE
        if (onPress) {
          onPress(); // Call the original onPress passed in props
        }
      };

      // Log disabled state for debugging
      // console.log('ActionButton - Title:', title, 'isDisabled:', isDisabled);

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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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
          } else { throw new Error('User data not found in response.'); }
        } catch (error: any) {
          console.error('Error fetching user profile:', error.message);
          Alert.alert('Error', 'Failed to fetch your profile data. Please try again later.');
          setUser(null);
        } finally { setIsLoading(false); }
      } else {
        Alert.alert('Authentication Error', 'Your session has expired. Please log in again.');
        setIsLoading(false);
        setUser(null);
        // Use try-catch for logout/reset during error handling
        try {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        } catch (logoutError) {
            console.error("Error during automatic logout:", logoutError);
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

  // ********** ONLY handleSave IS UPDATED BELOW **********
  const handleSave = async () => {
      if (!name.trim() || !phone.trim()) {
          Alert.alert('Validation Error', 'Name and phone cannot be empty.');
          return;
      }
      setIsSaving(true);
      // Ensure user state is not null before proceeding
      if (user) {
          try {
              const response = await fetchData(apiUrl, 'api/users/update-details', {
                  method: 'PUT',
                  body: { name: name.trim(), phone: phone.trim() },
                  // Assuming fetchData handles token implicitly
              });

              // Check if the response *and* response.user exist
              if (response?.user) {
                  // *** MODIFIED STATE UPDATE ***
                  // Merge existing user state with the updated fields from the response
                  setUser(currentUser => {
                      // If for some reason currentUser became null, use the response, otherwise merge
                      if (!currentUser) return response.user;
                      return {
                          ...currentUser, // Keep existing fields (_id, email, role, etc.)
                          name: response.user.name || currentUser.name,     // Update name from response, fallback to current
                          phone: response.user.phone || currentUser.phone,   // Update phone from response, fallback to current
                          // If the API might return other updated fields (like profilePic), merge them too:
                          // profilePic: response.user.profilePic !== undefined ? response.user.profilePic : currentUser.profilePic,
                      };
                  });
                  // *** END MODIFIED STATE UPDATE ***

                  // Update local state bound to TextInput for immediate feedback, using response or fallback
                  setName(response.user.name || name);
                  setPhone(response.user.phone || phone);

                  setIsEditing(false); // Exit editing mode
                  Alert.alert('Success', 'Profile updated successfully!');

              } else {
                  // Handle case where API response is successful (e.g., 200 OK)
                  // but doesn't contain the expected user data structure.
                  console.warn("Update successful but user data missing/incomplete in response:", response);
                  // You might still want to exit editing mode or inform the user.
                  // Optionally, you could trigger a full refetch here if merging is insufficient.
                  // await fetchUserProfile(); // Example: Force full refresh if needed (define fetchUserProfile outside useEffect if using this)
                  setIsEditing(false);
                  Alert.alert('Success', 'Profile updated! (Response format check recommended)');
                  // Or throw an error if user data is absolutely required from this endpoint for validation
                  // throw new Error('Updated user data format mismatch.');
              }
          } catch (error: any) {
              console.error('Error updating profile:', error.message);
              Alert.alert('Error', `Failed to update profile. ${error.message || 'Please try again.'}`);
              // Optionally revert local state changes on error
              // setName(user.name);
              // setPhone(user.phone);
          }
      } else {
          Alert.alert('Error', 'Current user data missing. Cannot save.');
      }
      setIsSaving(false);
  };
  // ********** END OF handleSave UPDATE **********

  const handleUpgradeRole = async () => {
    // Prevent action if already a driver
    if (user?.role?.includes('driver')) {
      Alert.alert('Already a Driver', 'Your account already has driver privileges.');
      return;
    }
    // Prevent action if user data is missing
    if (!user) {
      Alert.alert('Error', 'User data missing. Cannot upgrade role.');
      return;
    }

    setIsUpgrading(true);

    try {
      console.log("Attempting role upgrade..."); // Added log
      const response = await fetchData(apiUrl, 'api/users/upgrade-role', {
        method: 'PUT',
        // No body needed if the backend identifies the user via token
      });

      console.log("Role upgrade response received:", response); // Added log

      // --- REVISED SUCCESS HANDLING ---
      // Scenario 1: Request submitted for approval (API returns a success message)
      // Check for a specific success flag OR just a message if the API confirms success this way
      if (response?.success === true && response?.message) {
          // Show the backend's confirmation message directly
          Alert.alert('Request Submitted', response.message);
          // Optionally: You might want to disable the button temporarily or show a "Pending Approval" status somewhere
      }
      // Scenario 2: Role granted immediately (API returns updated user with 'driver' role)
      else if (response?.user && response.user.role?.includes('driver')) {
          setUser(response.user); // Update user state
          Alert.alert('Success', 'Your account has been upgraded to Driver!');
      }
      // Scenario 3: API call succeeded but response format is unexpected or indicates failure without throwing an error earlier
      else {
           // Use a specific message from the backend if available, otherwise a generic one
          const errorMessage = response?.message || response?.error || 'Role upgrade failed or confirmation not received.';
          console.warn("Role upgrade failed or response format unexpected:", response); // Log for debugging
          // Throw an error so it's caught by the catch block below as a failure
          throw new Error(errorMessage);
      }
      // --- END REVISED SUCCESS HANDLING ---

    } catch (error: any) {
      // This now catches actual fetch errors OR the explicitly thrown error from Scenario 3
      console.error('Error upgrading role:', error); // Log the full error
      // Display a user-friendly error message, using the error's message if available
      Alert.alert(
        'Upgrade Error', // Use a more specific title for actual errors
        `Failed to submit upgrade request. ${error.message || 'Please try again or contact support.'}`
      );
    } finally {
      setIsUpgrading(false); // Ensure loading state is always reset
    }
  };

  // *** UPDATED LOGOUT HANDLER with LOGGING ***
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
                        Alert.alert("Logout Error", "An unexpected error occurred during logout.");
                    }
                }
            }
        ],
        { cancelable: true } // Allow dismissing alert by tapping outside
    );
 };
 // *** END UPDATED LOGOUT HANDLER ***

  const handleAddTaxi = async () => {
    if (!numberPlate.trim() || !capacity.trim() || !routeName.trim() || !currentStop.trim()) { Alert.alert('Validation Error', 'Please fill in all taxi details.'); return; }
    const parsedCapacity = parseInt(capacity, 10);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) { Alert.alert('Validation Error', 'Please enter a valid positive number for capacity.'); return; }
    setIsAddingTaxi(true);
    try {
      const response = await fetchData(apiUrl, 'api/taxis/addTaxi', { method: 'POST', body: { numberPlate: numberPlate.trim(), routeName: routeName.trim(), capacity: parsedCapacity, currentStop: currentStop.trim(), }, });
      if (response?.taxi) {
        Alert.alert('Success', `Taxi ${response.taxi.numberPlate} added successfully!`);
        setNumberPlate(''); setCapacity(''); setCurrentStop(''); setRouteName(''); setIsTaxiFormVisible(false);
      } else { throw new Error(response?.message || 'Taxi data not received in response.'); }
    } catch (error: any) { console.error('Error adding taxi:', error.message); Alert.alert('Error', `Failed to add taxi. ${error.message || 'Please try again.'}`); }
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
          <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
              <SafeAreaView style={styles.safeArea}>
                   <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />
                   <View style={styles.header}>
                       <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                       <Text style={styles.headerTitle}>Profile Error</Text>
                       <View style={styles.headerButton} />
                   </View>
                  <View style={styles.errorContainer}>
                      <MaterialIcons name="error-outline" size={60} color="#D32F2F" />
                      <Text style={styles.errorText}>Could not load profile.</Text>
                      <Text style={styles.errorSubText}>Please check your connection or try logging out.</Text>
                       <TouchableOpacity style={styles.logoutButtonError} onPress={handleLogout}>
                           <Ionicons name="log-out-outline" size={20} color="#FFFFFF" style={{marginRight: 8}}/>
                           <Text style={styles.logoutButtonTextError}>Logout</Text>
                       </TouchableOpacity>
                  </View>
              </SafeAreaView>
          </LinearGradient>
      );
  }

  // --- Reusable Inline Components ---
  const InfoRow: React.FC<{ label: string; value: string | undefined; iconName: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome' }> =
    ({ label, value, iconName, iconFamily = 'Ionicons' }) => {
      const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
      // Note: This was changed in a previous example to handle array for roles, reverting to original simple value for consistency with user's provided code.
      // If roles *are* an array, use: const displayValue = Array.isArray(value) ? value.join(', ') : value;
      return (
        <View style={styles.infoRow}>
          <IconComponent name={iconName} size={20} color="#003E7E" style={styles.infoIcon} />
          <Text style={styles.infoLabel}>{label}:</Text>
          <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">{value || 'Not set'}</Text>
        </View>
      );
  };


  // --- Main JSX (Successful Load) ---
  // Add a final check for user just in case, though logic above should prevent null here
  if (!user) return <Loading />; // Or return error view again

  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
         <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />
        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
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
                              <FontAwesome name="pencil" size={16} color="#003E7E" />
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
                                   {isSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.editActionButtonText, styles.saveButtonText]}>Save Changes</Text>}
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
                  {/* Use optional chaining (?.) for safety when accessing user.role */}
                  {!(user?.role?.includes('driver')) && (
                      <ActionButton title="Upgrade to Driver" onPress={handleUpgradeRole} iconName="rocket-outline" loading={isUpgrading} style={{ marginBottom: 15 }} disabled={isUpgrading} />
                  )}
                   {user?.role?.includes('driver') && (
                       <ActionButton title="Manage My Taxi" onPress={() => handleNavigate('TaxiManagement')} iconName="settings-outline" style={{ marginBottom: 15 }} color="#1E88E5" />
                   )}

                  {/* --- LOGOUT BUTTON --- */}
                  <ActionButton title="Logout" onPress={handleLogout} iconName="log-out-outline" color="#D32F2F" style={{ marginBottom: 10 }} />
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
                        <Ionicons name={isTaxiFormVisible ? "chevron-up" : "chevron-down"} size={24} color="#003E7E" />
                    </TouchableOpacity>
                    {isTaxiFormVisible && (
                      <Animated.View style={styles.taxiFormContainer}>
                          <TextInput style={styles.input} placeholder="Number Plate" placeholderTextColor="#aaa" value={numberPlate} onChangeText={setNumberPlate} autoCapitalize="characters" />
                          <TextInput style={styles.input} placeholder="Capacity" placeholderTextColor="#aaa" value={capacity} keyboardType="numeric" onChangeText={setCapacity} />
                          <TextInput style={styles.input} placeholder="Current Stop / Rank" placeholderTextColor="#aaa" value={currentStop} onChangeText={setCurrentStop} />
                          <TextInput style={styles.input} placeholder="Primary Route Name" placeholderTextColor="#aaa" value={routeName} onChangeText={setRouteName} />
                          <ActionButton title="Register Taxi" onPress={handleAddTaxi} iconName="add-circle-outline" loading={isAddingTaxi} style={{ marginTop: 10 }} disabled={isAddingTaxi}/>
                      </Animated.View>
                    )}
                </View>
              )}
          </ScrollView>
        </Animated.View>
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