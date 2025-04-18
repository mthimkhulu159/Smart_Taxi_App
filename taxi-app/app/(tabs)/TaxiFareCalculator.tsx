import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    TouchableOpacity,
    Keyboard,
    TouchableWithoutFeedback,
    Platform,
    ViewStyle,
    TextStyle,
    Animated,
    Dimensions,
    // ImageStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { RootStackParamList } from '../types/navigation'; // (ADJUST PATH if needed)


// --- Interfaces & Types ---
interface Row { id: number; numPeople: string; amountPaid: string; }
interface CalculatedRow extends Row { amountDueForRow: string; changeDueToRow: string; isChangePositive: boolean; }
interface CalculationResult { rowCalculations: CalculatedRow[]; totalReceived: string; totalChangePassengers: string; }
interface Styles {
    gradient: ViewStyle; safeArea: ViewStyle; mainContainer: ViewStyle; header: ViewStyle; headerButton: ViewStyle; headerTitle: TextStyle; scrollContent: ViewStyle; section: ViewStyle; sectionTitle: TextStyle; inputGroup: ViewStyle; label: TextStyle; input: TextStyle; totalDueText: TextStyle; actionButtonBase: ViewStyle; actionButtonIcon: TextStyle; actionButtonText: TextStyle; actionButtonDisabled: ViewStyle; rowContainer: ViewStyle; rowHeader: TextStyle; rowInputGroup: ViewStyle; rowInputItem: ViewStyle; rowCalculation: ViewStyle; calculationText: TextStyle; positiveChange: TextStyle; negativeChange: TextStyle; removeButtonTouchable: ViewStyle; removeButtonText: TextStyle; totalsContainer: ViewStyle; totalText: TextStyle;
    addRowButtonContainer: ViewStyle; // New style for Add Row button container
    // Add Sidebar styles from example if Sidebar doesn't manage its own
    sidebarInternal?: ViewStyle; sidebarCloseButtonInternal?: ViewStyle; sidebarHeaderInternal?: ViewStyle; sidebarLogoIconInternal?: ViewStyle; sidebarTitleInternal?: TextStyle; sidebarButtonInternal?: ViewStyle; sidebarButtonActiveInternal?: ViewStyle; sidebarButtonTextInternal?: TextStyle; sidebarButtonTextActiveInternal?: TextStyle;
}
type TaxiFareCalculatorScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TaxiFareCalculator'>; // *** Adjust 'TaxiFareCalculator' if needed ***

// --- Main Component ---
const TaxiFareCalculator: React.FC = () => {
    // --- State ---
    const [taxiPrice, setTaxiPrice] = useState<string>('');
    const [totalPassengers, setTotalPassengers] = useState<string>('');
    const [rows, setRows] = useState<Row[]>([]);
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const navigation = useNavigation<TaxiFareCalculatorScreenNavigationProp>();

    // --- Animations ---
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    useEffect(() => {
        const timer = setTimeout(() => { Animated.parallel([ Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }), ]).start(); }, 100);
        return () => clearTimeout(timer);
    }, [fadeAnim, slideAnim]);

    // --- Handlers ---
    const handleSetTaxiPrice = (v: string) => { const c=v.replace(/[^0-9.]/g,''); if((c.match(/\./g)||[]).length>1)return; setTaxiPrice(c); };
    const handleSetTotalPassengers = (v: string) => { const c=v.replace(/[^0-9]/g,''); setTotalPassengers(c); };
    const handleAddRow = () => setRows((p) => [...p, { id: Date.now(), numPeople: '', amountPaid: '' }]);
    const handleRemoveRow = (id: number) => setRows((p) => p.filter((r) => r.id !== id));
    const handleRowChange = (id: number, field: keyof Pick<Row, 'numPeople'|'amountPaid'>, v: string) => { let c=v; if(field==='amountPaid'){c=v.replace(/[^0-9.]/g,''); if((c.match(/\./g)||[]).length>1)return;} else if(field==='numPeople'){c=v.replace(/[^0-9]/g,'');} setRows((p) => p.map((r) => r.id===id ? {...r, [field]: c} : r)); };
    const toggleSidebar = () => setSidebarVisible(!sidebarVisible);
    const handleNavigate = (screen: keyof RootStackParamList) => { setSidebarVisible(false); if (screen === 'TaxiFareCalculator') return; try { navigation.navigate({ name: screen, params: undefined, merge: true } as any); } catch (e) { console.error(`Nav failed: ${screen}`, e); } }; // Simplified nav handler

    // --- Calculations ---
    const parsedTaxiPrice = useMemo(() => parseFloat(taxiPrice) || 0, [taxiPrice]);
    const parsedTotalPassengers = useMemo(() => parseInt(totalPassengers, 10) || 0, [totalPassengers]);
    const totalAmountDueDriver = useMemo(() => parsedTaxiPrice * parsedTotalPassengers, [parsedTaxiPrice, parsedTotalPassengers]);
    const calculations = useMemo((): CalculationResult => { let totR=0, totC=0; const rowCalcs=rows.map((r)=>{ let nP=parseInt(r.numPeople,10)||0, aP=parseFloat(r.amountPaid)||0, due=0, chg=0; if(nP>0&&parsedTaxiPrice>0){due=nP*parsedTaxiPrice; if(aP>0){chg=aP-due; totR+=aP; if(chg>0){totC+=chg;}}}else if(aP>0){totR+=aP; chg=aP; totC+=chg;} return {...r, amountDueForRow:due.toFixed(2), changeDueToRow:chg.toFixed(2), isChangePositive:chg>=0}; }); return { rowCalculations:rowCalcs, totalReceived:totR.toFixed(2), totalChangePassengers:totC.toFixed(2) }; }, [rows, parsedTaxiPrice]);

    // --- Render ---
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="TaxiFareCalculator"/>
                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}>
                            <Ionicons name="menu" size={32} color="#003E7E" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Fare Calculator</Text>
                        <View style={styles.headerButton} />
                    </View>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} >
                            {/* Section 1: Basic Info */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Taxi Details</Text>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Taxi Price (per person): R</Text>
                                    <TextInput style={styles.input} value={taxiPrice} onChangeText={handleSetTaxiPrice} keyboardType="numeric" placeholder="e.g., 15.00" placeholderTextColor="#aaa" />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Total Number of Passengers:</Text>
                                    <TextInput style={styles.input} value={totalPassengers} onChangeText={handleSetTotalPassengers} keyboardType="numeric" placeholder="e.g., 10" placeholderTextColor="#aaa" />
                                </View>
                                {parsedTaxiPrice > 0 && parsedTotalPassengers > 0 && (<Text style={styles.totalDueText}>Total Amount Due to Driver: R{totalAmountDueDriver.toFixed(2)}</Text>)}
                            </View>
                            {/* Section 2: Passenger Rows */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Passenger Payments</Text>
                                {calculations.rowCalculations.length === 0 && (<Text style={{ color: '#666', textAlign: 'center', fontStyle: 'italic', marginBottom: 20}}> Press "+ Add Row" below to record payments.</Text>)}
                                {calculations.rowCalculations.map((row, index) => (
                                    <View key={row.id} style={styles.rowContainer}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                            <Text style={styles.rowHeader}>Row {index + 1}</Text>
                                            <TouchableOpacity style={styles.removeButtonTouchable} onPress={() => handleRemoveRow(row.id)}>
                                                <Ionicons name="trash-outline" size={22} color="#dc3545" />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.rowInputGroup}>
                                            <View style={styles.rowInputItem}>
                                                <Text style={styles.label}>People:</Text>
                                                <TextInput style={styles.input} value={row.numPeople} onChangeText={(v) => handleRowChange(row.id, 'numPeople', v)} keyboardType="numeric" placeholder="e.g., 4" placeholderTextColor="#aaa" />
                                            </View>
                                            <View style={styles.rowInputItem}>
                                                <Text style={styles.label}>Amount Paid (R):</Text>
                                                <TextInput style={styles.input} value={row.amountPaid} onChangeText={(v) => handleRowChange(row.id, 'amountPaid', v)} keyboardType="numeric" placeholder="e.g., 100.00" placeholderTextColor="#aaa" />
                                            </View>
                                        </View>
                                        <View style={styles.rowCalculation}>
                                            <Text style={styles.calculationText}>Amount Due: R{row.amountDueForRow}</Text>
                                            {/* Ensure space is inside the template literal */}
                                            <Text style={row.isChangePositive ? styles.positiveChange : styles.negativeChange}>
                                                {` Change: R${row.changeDueToRow}`}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                                {/* Add Row Button Moved Here */}
                                <View style={styles.addRowButtonContainer}>
                                    <TouchableOpacity
                                        style={[styles.actionButtonBase, { backgroundColor: '#005A9C', paddingVertical: 12, paddingHorizontal: 20 }]}
                                        onPress={handleAddRow}
                                    >
                                        <Ionicons name="add" size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                                        <Text style={[styles.actionButtonText, { fontSize: 16 }]}>Add Row</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {/* Section 3: Totals */}
                            {rows.length > 0 && (
                                <View style={[styles.section, styles.totalsContainer]}>
                                    <Text style={styles.sectionTitle}>Summary</Text>
                                    {/* --- FIX AREA START --- */}
                                    {/* Use template literals to ensure space is part of the text node */}
                                    <Text style={styles.totalText}>
                                        <MaterialCommunityIcons name="cash-multiple" size={20} color="#003E7E" />
                                        {` Total Received: R${calculations.totalReceived}`}
                                    </Text>
                                    <Text style={styles.totalText}>
                                        <MaterialCommunityIcons name="cash-refund" size={20} color="green" />
                                        {` Total Change Due: R${calculations.totalChangePassengers}`}
                                    </Text>
                                    {/* --- FIX AREA END --- */}
                                </View>
                            )}
                        </ScrollView>
                    </TouchableWithoutFeedback>
                </Animated.View>
            </SafeAreaView>
        </LinearGradient>
    );
};

// --- Styles (remain mostly the same, with a new style for the Add Row button container) ---
const styles = StyleSheet.create<Styles>({
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    mainContainer: { flex: 1, },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '600', color: '#000000' },
    scrollContent: { paddingHorizontal: 15, paddingBottom: 40, paddingTop: 10 },
    section: { marginBottom: 25, backgroundColor: 'rgba(255, 255, 255, 0.7)', padding: 15, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#003E7E', marginBottom: 15 },
    inputGroup: { marginBottom: 15 },
    label: { fontSize: 14, marginBottom: 6, color: '#333', fontWeight: '500' },
    input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 8, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 16, color: '#000000', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1 },
    totalDueText: { fontSize: 16, fontWeight: 'bold', marginTop: 10, textAlign: 'center', color: '#2a9d8f', paddingVertical: 8, backgroundColor: '#e8f7f5', borderRadius: 6 },
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 8 },
    actionButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF'},
    actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },
    rowContainer: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10, padding: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
    rowHeader: { fontSize: 16, fontWeight: '600', color: '#444' },
    rowInputGroup: { flexDirection: 'row', marginBottom: 10 },
    rowInputItem: { flex: 1, marginHorizontal: 5 },
    rowCalculation: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', flexDirection: 'row', justifyContent: 'space-between' },
    calculationText: { fontSize: 14, color: '#555' },
    positiveChange: { fontSize: 14, color: 'green', fontWeight: 'bold' },
    negativeChange: { fontSize: 14, color: 'red', fontWeight: 'bold' },
    removeButtonTouchable: { padding: 5, marginRight: -5 },
    removeButtonText: { color: '#dc3545', fontSize: 14, fontWeight: '500' },
    totalsContainer: { marginTop: 10 },
    totalText: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333', flexDirection: 'row', alignItems: 'center' },
    addRowButtonContainer: { // New style to center the Add Row button
        paddingVertical: 15,
        alignItems: 'center',
    },
    // Sidebar Styles (Remove if Sidebar component handles its own styles)
    sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: 10, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 },
    sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
    sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },
});

export default TaxiFareCalculator;