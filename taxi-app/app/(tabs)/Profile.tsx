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
  ViewStyle // Added for Sidebar typing consistency
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome, MaterialIcons, Ionicons, AntDesign } from '@expo/vector-icons';
import { fetchData, getToken } from '../api/api'; // Assuming getToken exists here too
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/authContext'; // Assuming correct path
import { apiUrl } from '../api/apiUrl';

// --- Constants ---
const { width: windowWidth } = Dimensions.get('window');

// --- Navigation Types (Ensure this is consistent across your app) ---
type RootStackParamList = {
  Home: { acceptedTaxiId?: string };
  requestRide: undefined;
  ViewTaxi: undefined;
  ViewRequests: undefined;
  LiveChat: undefined;
  TaxiManagement: undefined;
  Profile: undefined; // Current screen
  AcceptedRequest: undefined;
  AcceptedPassenger: undefined;
  ViewRoute: undefined;
  Auth: undefined; // Added for logout navigation
  // Add other screens if necessary
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


// --- Reusable Components Defined Directly In This File ---

// --- Enhanced Sidebar Component (Copied from HomeScreen) ---
const Sidebar: React.FC<SidebarProps> = ({ isVisible, onClose, onNavigate, activeScreen }) => {
  const slideAnim = useRef(new Animated.Value(-300)).current; // Match HomeScreen width

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : -300, // Match HomeScreen width
      duration: 300,
      useNativeDriver: true, // Use Native Driver if possible for performance
    }).start();
  }, [isVisible, slideAnim]);

  const NavItem: React.FC<{ screen: keyof RootStackParamList; label: string; icon: React.ReactNode }> = ({ screen, label, icon }) => (
    <TouchableOpacity
      style={[styles.sidebarButtonInternal, activeScreen === screen && styles.sidebarButtonActiveInternal]} // Use distinct style names
      onPress={() => { onNavigate(screen); onClose(); }}
    >
      {icon}
      <Text style={[styles.sidebarButtonTextInternal, activeScreen === screen && styles.sidebarButtonTextActiveInternal]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[styles.sidebarInternal, { transform: [{ translateX: slideAnim }] }]}> {/* Use distinct style name */}
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={styles.sidebarCloseButtonInternal} onPress={onClose}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.sidebarHeaderInternal}>
          <Ionicons name="car-sport-outline" size={40} color="#FFFFFF" style={styles.sidebarLogoIconInternal} />
          <Text style={styles.sidebarTitleInternal}>Shesha</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Ensure all navigation items match RootStackParamList keys */}
          <NavItem screen="Home" label="Home" icon={<FontAwesome name="home" size={22} color="#FFFFFF" />} />
          <NavItem screen="requestRide" label="Request Ride" icon={<FontAwesome name="car" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewTaxi" label="View Taxis" icon={<MaterialIcons name="local-taxi" size={22} color="#FFFFFF" />} />
           <NavItem screen="ViewRoute" label="View Routes" icon={<MaterialIcons name="route" size={22} color="#FFFFFF" />} />
          <NavItem screen="AcceptedRequest" label="My Ride" icon={<FontAwesome name="check-circle" size={22} color="#FFFFFF" />} />
          <NavItem screen="AcceptedPassenger" label="View Passenger" icon={<FontAwesome name="circle" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewRequests" label="Search Rides" icon={<FontAwesome name="search" size={22} color="#FFFFFF" />} />
          <NavItem screen="LiveChat" label="Live Chat" icon={<Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />} />
          <NavItem screen="TaxiManagement" label="Manage Taxi" icon={<MaterialIcons name="settings" size={22} color="#FFFFFF" />} />
          <NavItem screen="Profile" label="Profile" icon={<FontAwesome name="user-circle-o" size={22} color="#FFFFFF" />} />
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

// --- Loading Component (Copied from HomeScreen) ---
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
    // Ensured Loading component uses the correct styles defined later
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
      setIsLoading(true); // Set loading true at the start
      const token = await getToken();
      if (token) {
        try {
          const response = await fetchData(apiUrl, 'api/users/get-user', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response?.user) {
            setUser(response.user);
            setName(response.user.name);
            setPhone(response.user.phone);
          } else {
             throw new Error('User data not found in response.');
          }
        } catch (error: any) {
          console.error('Error fetching user profile:', error.message);
          Alert.alert('Error', 'Failed to fetch your profile data. Please try again.');
          setUser(null); // Set user to null on error
        } finally {
            setIsLoading(false); // Set loading false after fetch attempt (success or fail)
        }
      } else {
          Alert.alert('Authentication Error', 'Could not find authentication token. Please log in.');
          setIsLoading(false); // Stop loading
          setUser(null); // Ensure user is null
          logout();
          navigation.navigate('Auth');
      }
    };

    fetchUserProfile();
  }, [navigation, logout]); // Added dependencies

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

  // --- Handlers (handleSave, handleUpgradeRole, handleLogout, handleAddTaxi remain the same) ---
   const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
        Alert.alert('Validation Error', 'Name and phone cannot be empty.');
        return;
    }
    setIsSaving(true);
    const token = await getToken();
    if (token && user) {
      try {
        const response = await fetchData(apiUrl, 'api/users/update-details', {
          method: 'PUT',
          body: { name: name.trim(), phone: phone.trim() },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response?.user) {
          setUser(response.user);
          setName(response.user.name);
          setPhone(response.user.phone);
          setIsEditing(false);
          Alert.alert('Success', 'Profile updated successfully!');
        } else {
             throw new Error('Updated user data not received.');
        }
      } catch (error: any) {
        console.error('Error updating profile:', error.message);
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } else {
        Alert.alert('Error', 'Authentication error or user data missing.');
    }
    setIsSaving(false);
  };

  const handleUpgradeRole = async () => {
    if (user?.role.includes('driver')) {
      Alert.alert('Already a Driver', 'Your account already has driver privileges.');
      return;
    }
    setIsUpgrading(true);
    const token = await getToken();
    if (token && user) {
      try {
        const response = await fetchData(apiUrl, 'api/users/upgrade-role', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response?.user && response.user.role.includes('driver')) {
          setUser(response.user);
          Alert.alert('Success', 'Your account has been upgraded to Driver!');
        } else {
          throw new Error('Role upgrade confirmation not received or failed.');
        }
      } catch (error: any) {
        console.error('Error upgrading role:', error.message);
        Alert.alert('Error', 'Failed to upgrade role. Please contact support if this persists.');
      }
    } else {
        Alert.alert('Error', 'Authentication error or user data missing.');
    }
    setIsUpgrading(false);
  };

  const handleLogout = async () => {
    Alert.alert(
        "Confirm Logout",
        "Are you sure you want to log out?",
        [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    await logout();
                    navigation.navigate('Auth');
                }
            }
        ]
    );
  };

  const handleAddTaxi = async () => {
    if (!numberPlate.trim() || !capacity.trim() || !routeName.trim() || !currentStop.trim()) {
        Alert.alert('Validation Error', 'Please fill in all taxi details.');
        return;
    }
    const parsedCapacity = parseInt(capacity, 10);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
        Alert.alert('Validation Error', 'Please enter a valid positive number for capacity.');
        return;
    }

    setIsAddingTaxi(true);
    const token = await getToken();
    if (token) {
      try {
        const response = await fetchData(apiUrl, 'api/taxis/addTaxi', {
          method: 'POST',
          body: {
            numberPlate: numberPlate.trim(),
            routeName: routeName.trim(),
            capacity: parsedCapacity,
            currentStop: currentStop.trim(),
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response?.taxi) {
          Alert.alert('Success', `Taxi ${response.taxi.numberPlate} added successfully!`);
          setNumberPlate('');
          setCapacity('');
          setCurrentStop('');
          setRouteName('');
          setIsTaxiFormVisible(false);
        } else {
             throw new Error('Taxi data not received in response.');
        }
      } catch (error: any) {
        console.error('Error adding taxi:', error.message)
        Alert.alert('Error', `Failed to add taxi. ${error.message || 'Please try again.'}`);
      }
    } else {
        Alert.alert('Error', 'Authentication error.');
    }
    setIsAddingTaxi(false);
  };

   const handleNavigate = (screen: keyof RootStackParamList) => {
     setSidebarVisible(false);
     switch (screen) {
        case 'Home':
            navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true });
            break;
        case 'requestRide':
            navigation.navigate({ name: 'requestRide', params: undefined, merge: true });
            break;
        case 'ViewTaxi':
            navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true });
            break;
        case 'ViewRoute':
             navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true });
             break;
        case 'ViewRequests':
            navigation.navigate({ name: 'ViewRequests', params: undefined, merge: true });
            break;
        case 'LiveChat':
            navigation.navigate({ name: 'LiveChat', params: undefined, merge: true });
            break;
        case 'TaxiManagement':
            navigation.navigate({ name: 'TaxiManagement', params: undefined, merge: true });
            break;
        case 'Profile':
            break; // Already here
        case 'AcceptedRequest':
            navigation.navigate({ name: 'AcceptedRequest', params: undefined, merge: true });
            break;
        case 'AcceptedPassenger':
            navigation.navigate({ name: 'AcceptedPassenger', params: undefined, merge: true });
            break;
        case 'Auth':
            navigation.navigate({ name: 'Auth', params: undefined, merge: true });
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
  if (isLoading) {
    // Use the Loading component defined above
    return <Loading />;
  }

  if (!user) {
      // Error state if user data couldn't be loaded
      return (
          <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
              <SafeAreaView style={styles.safeArea}>
                  {/* You might still want the header and sidebar on the error screen */}
                  <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />
                   <View style={styles.header}>
                       <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}>
                         <Ionicons name="menu" size={32} color="#003E7E" />
                       </TouchableOpacity>
                       <Text style={styles.headerTitle}>Profile Error</Text>
                       <View style={styles.headerButton} />
                   </View>
                  <View style={styles.errorContainer}>
                     <MaterialIcons name="error-outline" size={60} color="#D32F2F" />
                      <Text style={styles.errorText}>Could not load profile.</Text>
                      <Text style={styles.errorSubText}>Please check your connection and try logging out.</Text>
                       <TouchableOpacity style={styles.logoutButtonError} onPress={handleLogout}>
                           <Text style={styles.logoutButtonTextError}>Logout</Text>
                       </TouchableOpacity>
                  </View>
              </SafeAreaView>
          </LinearGradient>
      );
  }

  // --- Reusable Inline Components (InfoRow, ActionButton) ---
  const InfoRow: React.FC<{ label: string; value: string | undefined; iconName: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome' }> =
    ({ label, value, iconName, iconFamily = 'Ionicons' }) => {
      const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
      return (
        <View style={styles.infoRow}>
          <IconComponent name={iconName} size={20} color="#003E7E" style={styles.infoIcon} />
          <Text style={styles.infoLabel}>{label}:</Text>
          <Text style={styles.infoValue}>{value || 'Not set'}</Text>
        </View>
      );
  };

   const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object }> =
     ({ onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E', textColor = '#FFFFFF', loading = false, style = {} }) => {
       const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
       return (
         <TouchableOpacity style={[styles.actionButtonBase, { backgroundColor: color }, style]} onPress={onPress} disabled={loading}>
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

  // --- Main JSX ---
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
         {/* Use the Sidebar component defined above */}
         <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Profile" />

        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
           <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}>
                  <Ionicons name="menu" size={32} color="#003E7E" />
                </TouchableOpacity>
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
                                <TouchableOpacity style={[styles.editActionButton, styles.cancelButton]} onPress={() => { setIsEditing(false); setName(user.name); setPhone(user.phone); }}>
                                    <Text style={[styles.editActionButtonText, styles.cancelButtonText]}>Cancel</Text>
                                </TouchableOpacity>
                                 <TouchableOpacity style={[styles.editActionButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>
                                    {isSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.editActionButtonText, styles.saveButtonText]}>Save Changes</Text>}
                                 </TouchableOpacity>
                            </View>
                       </View>
                   ) : (
                       <View style={styles.infoContainer}>
                            <InfoRow label="Name" value={user.name} iconName="person-outline" />
                            <InfoRow label="Email" value={user.email} iconName="mail-outline" />
                            <InfoRow label="Phone" value={user.phone} iconName="call-outline" />
                            <InfoRow label="Roles" value={user.role?.join(', ')} iconName="shield-checkmark-outline" />
                       </View>
                   )}
              </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Actions</Text>
                    {!user.role.includes('driver') && (
                        <ActionButton title="Upgrade to Driver Account" onPress={handleUpgradeRole} iconName="rocket-outline" loading={isUpgrading} style={{ marginBottom: 15 }} />
                    )}
                     {user.role.includes('driver') && (
                         <ActionButton title="Manage My Taxi" onPress={() => handleNavigate('TaxiManagement')} iconName="settings-outline" style={{ marginBottom: 15 }} color="#1E88E5" />
                     )}
                     <ActionButton title="Logout" onPress={handleLogout} iconName="log-out-outline" color="#D32F2F" style={{ marginBottom: 10 }} />
                </View>

              {user.role.includes('driver') && (
                <View style={styles.sectionCard}>
                    <TouchableOpacity style={styles.addTaxiHeader} onPress={() => setIsTaxiFormVisible(!isTaxiFormVisible)}>
                         <Text style={styles.sectionTitle}>Register New Taxi</Text>
                        <Ionicons name={isTaxiFormVisible ? "chevron-up" : "chevron-down"} size={24} color="#003E7E" />
                    </TouchableOpacity>
                  {isTaxiFormVisible && (
                    <Animated.View style={styles.taxiFormContainer}>
                      <TextInput style={styles.input} placeholder="Number Plate (e.g., AB 12 CD GP)" placeholderTextColor="#aaa" value={numberPlate} onChangeText={setNumberPlate} autoCapitalize="characters" />
                      <TextInput style={styles.input} placeholder="Capacity (Number of seats)" placeholderTextColor="#aaa" value={capacity} keyboardType="numeric" onChangeText={setCapacity} />
                      <TextInput style={styles.input} placeholder="Current Stop / Rank Name" placeholderTextColor="#aaa" value={currentStop} onChangeText={setCurrentStop} />
                       <TextInput style={styles.input} placeholder="Primary Route Name (e.g., Town to Ikageng)" placeholderTextColor="#aaa" value={routeName} onChangeText={setRouteName} />
                      <ActionButton title="Register This Taxi" onPress={handleAddTaxi} iconName="add-circle-outline" loading={isAddingTaxi} style={{ marginTop: 10 }} />
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

// --- Styles ---
const styles = StyleSheet.create({
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  profilePicContainer: { alignItems: 'center', marginBottom: 20 },
  profilePic: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#003E7E', backgroundColor: '#E0EFFF' },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#E0E0E0', elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
   sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#000000' },
   editButtonInline: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 15, backgroundColor: '#E8F0FE' },
    editButtonText: { marginLeft: 5, color: '#003E7E', fontWeight: '500', fontSize: 14 },
   infoContainer: {},
   infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
    infoIcon: { marginRight: 12, width: 20, textAlign: 'center' },
    infoLabel: { fontSize: 15, color: '#555555', fontWeight: '500', width: 70 },
    infoValue: { fontSize: 15, color: '#000000', fontWeight: '600', flex: 1 },
   editingContainer: { marginTop: 10 },
   input: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: '#000000', marginBottom: 15 },
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
  addTaxiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  taxiFormContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#EEEEEE' },
   errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: 'transparent' },
    errorText: { fontSize: 20, fontWeight: 'bold', color: '#D32F2F', textAlign: 'center', marginTop: 15 },
    errorSubText: { fontSize: 16, color: '#555555', textAlign: 'center', marginTop: 10, marginBottom: 20 },
    logoutButtonError: { marginTop: 20, backgroundColor: '#D32F2F', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center' }, // Distinct style name
    logoutButtonTextError: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }, // Distinct style name

  // --- Sidebar Styles (Copied from HomeScreen, renamed with Internal suffix) ---
    sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: 10, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 }, // Added padding
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 },
    sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
    sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },

  // --- Loading Styles (Copied from HomeScreen, renamed with Internal suffix) ---
   loadingGradient: { flex: 1 }, // Added gradient for loading screen consistency
   loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' }, // Removed background color as gradient handles it
   loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
});

export default ProfileScreen;