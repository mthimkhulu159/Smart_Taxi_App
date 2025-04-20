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
    // StyleProp, // Not strictly needed for this version
    // ImageStyle,
} from 'react-native';
// Removed LinearGradient as we're using a solid background
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons'; // Keep icons
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { RootStackParamList } from '../types/navigation'; // (ADJUST PATH if needed)

// --- Constants ---
const COLORS = {
    // Light Theme Palette
    background: '#F8F9FA',    // Very light gray
    cardBackground: '#FFFFFF',    // White
    cardBorder: '#DEE2E6',    // Light gray border
    shadow: 'rgba(0, 0, 0, 0.08)', // Soft shadow color
    textPrimary: '#212529',    // Very dark gray (almost black)
    textSecondary: '#6C757D',    // Medium gray
    textPlaceholder: '#ADB5BD',    // Lighter gray for placeholders
    primary: '#007BFF',    // Standard Blue
    primaryLight: 'rgba(0, 123, 255, 0.1)', // Light blue for highlights
    textOnPrimary: '#FFFFFF',    // White text for primary buttons
    inputBorder: '#CED4DA',    // Gray border for inputs
    inputFocusBorder: '#80BDFF',    // Lighter blue for focus (optional)
    positive: '#28A745',    // Green
    negative: '#DC3545',    // Red
    headerBackground: '#FFFFFF',
    headerBorder: '#E9ECEF',
};

// --- Interfaces & Types (Keep structure, update style names) ---
interface Row { id: number; numPeople: string; amountPaid: string; }
interface CalculatedRow extends Row { amountDueForRow: string; changeDueToRow: string; isChangePositive: boolean; }
interface CalculationResult { rowCalculations: CalculatedRow[]; totalReceived: string; totalChangePassengers: string; }

// Redefined Styles Interface for Light Theme
interface ComponentStyles {
    safeArea: ViewStyle;
    container: ViewStyle; // Replaces mainContainer for clarity
    // Header
    header: ViewStyle;
    headerButton: ViewStyle;
    headerTitle: TextStyle;
    // Content & Cards
    scrollContent: ViewStyle;
    card: ViewStyle;
    cardTitle: TextStyle;
    // Input Fields
    inputGroup: ViewStyle;
    label: TextStyle;
    input: TextStyle; // TextInput style
    highlightText: TextStyle; // For Total Due Driver / potentially other highlights
    // Rows (Payment Section)
    rowItem: ViewStyle; // Replaces rowContainer/rowCard
    rowHeader: ViewStyle;
    rowTitle: TextStyle;
    removeButton: ViewStyle;
    rowContent: ViewStyle;
    rowInputGroup: ViewStyle; // Grouping label + input within a row
    rowInput: TextStyle; // Style specific to inputs within rows
    rowCalculation: ViewStyle;
    calculationText: TextStyle;
    positiveText: TextStyle; // Replaces positiveChange
    negativeText: TextStyle; // Replaces negativeChange
    noRowsText: TextStyle;
    // Buttons
    addButton: ViewStyle; // Replaces actionButtonBase/addRowButton
    addButtonText: TextStyle;
    // Summary Section
    summaryCard: ViewStyle; // Specific style if needed, else use 'card'
    summaryRow: ViewStyle;
    summaryLabel: TextStyle;
    summaryValue: TextStyle;
    summaryIcon: TextStyle; // Still TextStyle for Icon component
    // Sidebar (Updated for Light Theme)
    sidebarInternal?: ViewStyle;
    sidebarCloseButtonInternal?: ViewStyle;
    sidebarHeaderInternal?: ViewStyle;
    sidebarLogoIconInternal?: ViewStyle; // Placeholder style if needed
    sidebarTitleInternal?: TextStyle;
    sidebarButtonInternal?: ViewStyle;
    sidebarButtonActiveInternal?: ViewStyle;
    sidebarButtonTextInternal?: TextStyle;
    sidebarButtonTextActiveInternal?: TextStyle;
}

type TaxiFareCalculatorScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TaxiFareCalculator'>; // *** Adjust 'TaxiFareCalculator' if needed ***

// --- Main Component ---
const TaxiFareCalculator: React.FC = () => {
    // --- State (Keep Existing Logic) ---
    const [taxiPrice, setTaxiPrice] = useState<string>('');
    const [totalPassengers, setTotalPassengers] = useState<string>('');
    const [rows, setRows] = useState<Row[]>([]);
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const navigation = useNavigation<TaxiFareCalculatorScreenNavigationProp>();

    // --- Animations (Keep Existing Logic) ---
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }), // Slightly faster
                Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]).start();
        }, 100);
        return () => clearTimeout(timer);
    }, [fadeAnim, slideAnim]);

    // --- Handlers (Keep Existing Logic) ---
    const handleSetTaxiPrice = (v: string) => { const c = v.replace(/[^0-9.]/g, ''); if ((c.match(/\./g) || []).length > 1) return; setTaxiPrice(c); };
    const handleSetTotalPassengers = (v: string) => { const c = v.replace(/[^0-9]/g, ''); setTotalPassengers(c); };
    const handleAddRow = () => setRows((p) => [...p, { id: Date.now(), numPeople: '', amountPaid: '' }]);
    const handleRemoveRow = (id: number) => setRows((p) => p.filter((r) => r.id !== id));
    const handleRowChange = (id: number, field: keyof Pick<Row, 'numPeople' | 'amountPaid'>, v: string) => { let c = v; if (field === 'amountPaid') { c = v.replace(/[^0-9.]/g, ''); if ((c.match(/\./g) || []).length > 1) return; } else if (field === 'numPeople') { c = v.replace(/[^0-9]/g, ''); } setRows((p) => p.map((r) => r.id === id ? { ...r, [field]: c } : r)); };
    const toggleSidebar = () => setSidebarVisible(!sidebarVisible);
    const handleNavigate = (screen: keyof RootStackParamList) => { setSidebarVisible(false); if (screen === 'TaxiFareCalculator') return; try { navigation.navigate({ name: screen, params: undefined, merge: true } as any); } catch (e) { console.error(`Nav failed: ${screen}`, e); } };

    // --- Calculations (Keep Existing Logic) ---
    const parsedTaxiPrice = useMemo(() => parseFloat(taxiPrice) || 0, [taxiPrice]);
    const parsedTotalPassengers = useMemo(() => parseInt(totalPassengers, 10) || 0, [totalPassengers]);
    const totalAmountDueDriver = useMemo(() => parsedTaxiPrice * parsedTotalPassengers, [parsedTaxiPrice, parsedTotalPassengers]);
    const calculations = useMemo((): CalculationResult => {
        let totR = 0, totC = 0;
        const rowCalcs = rows.map((r) => {
            let nP = parseInt(r.numPeople, 10) || 0, aP = parseFloat(r.amountPaid) || 0, due = 0, chg = 0;
            if (nP > 0 && parsedTaxiPrice > 0) {
                due = nP * parsedTaxiPrice;
                if (aP > 0) {
                    chg = aP - due;
                    totR += aP; if (chg > 0) { totC += chg; }
                }
            } else if (aP > 0) { totR += aP; chg = aP; totC += chg; }
            return { ...r, amountDueForRow: due.toFixed(2), changeDueToRow: chg.toFixed(2), isChangePositive: chg >= 0 };
        });
        return { rowCalculations: rowCalcs, totalReceived: totR.toFixed(2), totalChangePassengers: totC.toFixed(2) };
    }, [rows, parsedTaxiPrice]);

    // --- Render ---
    return (
        // Use SafeAreaView as the main background container
        <SafeAreaView style={styles.safeArea}>
            <Sidebar
                isVisible={sidebarVisible}
                onClose={toggleSidebar}
                onNavigate={handleNavigate}
                activeScreen="TaxiFareCalculator"
                // Pass light theme styles if Sidebar accepts them via props
                // Or rely on the internal styles defined below matching the theme
            />

            <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}>
                        <Ionicons name="menu" size={28} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Fare Calculator</Text>
                    <View style={styles.headerButton} />{/* Placeholder */}
                </View>

                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                        {/* Card 1: Setup */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Trip Details</Text>

                            {/* Price Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Price per Person (R)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={taxiPrice}
                                    onChangeText={handleSetTaxiPrice}
                                    keyboardType="numeric"
                                    placeholder="Enter amount"
                                    placeholderTextColor={COLORS.textPlaceholder}
                                    selectionColor={COLORS.primary}
                                />
                            </View>

                            {/* Passengers Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Total Passengers</Text>
                                <TextInput
                                    style={styles.input}
                                    value={totalPassengers}
                                    onChangeText={handleSetTotalPassengers}
                                    keyboardType="numeric"
                                    placeholder="Enter number"
                                    placeholderTextColor={COLORS.textPlaceholder}
                                    selectionColor={COLORS.primary}
                                />
                            </View>

                            {/* Total Due Display */}
                            {totalAmountDueDriver > 0 && (
                                <Text style={styles.highlightText}>
                                    Total Due to Driver: R {totalAmountDueDriver.toFixed(2)}
                                </Text>
                            )}
                        </View>

                        {/* Card 2: Passenger Payments */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Payments Received</Text>

                            {calculations.rowCalculations.length === 0 && (
                                <Text style={styles.noRowsText}>
                                    No payments recorded yet. Add rows below.
                                </Text>
                            )}

                            {calculations.rowCalculations.map((row, index) => (
                                <View key={row.id} style={styles.rowItem}>
                                    <View style={styles.rowHeader}>
                                        <Text style={styles.rowTitle}>Row {index + 1}</Text>
                                        <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveRow(row.id)}>
                                            <Feather name="x" size={20} color={COLORS.negative} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.rowContent}>
                                        <View style={styles.rowInputGroup}>
                                            <Text style={styles.label}>People</Text>
                                            <TextInput
                                                style={styles.rowInput}
                                                value={row.numPeople}
                                                onChangeText={(v) => handleRowChange(row.id, 'numPeople', v)}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                placeholderTextColor={COLORS.textPlaceholder}
                                                selectionColor={COLORS.primary}
                                            />
                                        </View>
                                        <View style={styles.rowInputGroup}>
                                            <Text style={styles.label}>Paid (R)</Text>
                                            <TextInput
                                                style={styles.rowInput}
                                                value={row.amountPaid}
                                                onChangeText={(v) => handleRowChange(row.id, 'amountPaid', v)}
                                                keyboardType="numeric"
                                                placeholder="0.00"
                                                placeholderTextColor={COLORS.textPlaceholder}
                                                selectionColor={COLORS.primary}
                                            />
                                        </View>
                                    </View>
                                    {/* Row Calculations - Conditionally Render */}
                                    {(parseInt(row.numPeople, 10) > 0 || parseFloat(row.amountPaid) > 0) && (
                                      <View style={styles.rowCalculation}>
                                        <Text style={styles.calculationText}>Due: R {row.amountDueForRow}</Text>
                                        <Text style={[styles.calculationText, row.isChangePositive ? styles.positiveText : styles.negativeText]}>
                                            Change: R {row.changeDueToRow}
                                        </Text>
                                      </View>
                                    )}
                                </View>
                            ))}

                            {/* Add Row Button */}
                            <TouchableOpacity style={styles.addButton} onPress={handleAddRow}>
                                <Feather name="plus" size={18} color={COLORS.textOnPrimary} style={{ marginRight: 8 }} />
                                <Text style={styles.addButtonText}>Add New Row</Text>
                            </TouchableOpacity>
                        </View>


                        {/* Card 3: Summary */}
                        {rows.length > 0 && (
                            <View style={[styles.card, styles.summaryCard]}>
                                <Text style={styles.cardTitle}>Trip Summary</Text>
                                {/* Total Received */}
                                <View style={styles.summaryRow}>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <Feather name="dollar-sign" size={18} color={COLORS.textSecondary} style={styles.summaryIcon} />
                                        <Text style={styles.summaryLabel}>Total Received:</Text>
                                    </View>
                                    <Text style={styles.summaryValue}>R {calculations.totalReceived}</Text>
                                </View>
                                {/* Total Change Due */}
                                <View style={styles.summaryRow}>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <Feather name="corner-down-left" size={18} color={COLORS.positive} style={styles.summaryIcon} />
                                        <Text style={styles.summaryLabel}>Total Change Due:</Text>
                                    </View>
                                    <Text style={[styles.summaryValue, {color: COLORS.positive}]}>R {calculations.totalChangePassengers}</Text>
                                </View>
                            </View>
                        )}

                    </ScrollView>
                </TouchableWithoutFeedback>
            </Animated.View>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create<ComponentStyles>({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background, // Apply background color here
    },
    container: {
        flex: 1,
        // Removed background color from here
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? 15 : 10,
        paddingBottom: 12,
        backgroundColor: COLORS.headerBackground,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.headerBorder,
    },
    headerButton: { padding: 5, minWidth: 40, alignItems: 'center' }, // Adjusted padding
    headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary }, // Slightly smaller
    // Content & Cards
    scrollContent: {
        padding: 15, // Consistent padding
        paddingBottom: 40,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: 10, // Slightly less rounded
        padding: 18,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.7, // Use opacity from constant
        shadowRadius: 4,
        elevation: 3, // For Android
    },
    cardTitle: {
        fontSize: 17, // Adjusted size
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: 18,
        paddingBottom: 5,
        // borderBottomWidth: 1, // Optional: Add separator back
        // borderBottomColor: COLORS.headerBorder,
    },
    // Input Fields
    inputGroup: {
        marginBottom: 18,
    },
    label: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        backgroundColor: COLORS.cardBackground, // Match card background or make slightly off
        borderBottomWidth: 1, // Underline style
        borderColor: COLORS.inputBorder,
        borderRadius: 0, // Remove radius for underline style
        paddingHorizontal: 5, // Adjust padding for underline
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    highlightText: { // For Total Due Driver
        fontSize: 16,
        fontWeight: '600',
        marginTop: 15,
        textAlign: 'center',
        color: COLORS.primary,
        paddingVertical: 10,
        backgroundColor: COLORS.primaryLight, // Use light primary color
        borderRadius: 6,
    },
    // Rows (Payment Section)
    rowItem: {
        backgroundColor: 'transparent', // Rows blend into card
        borderBottomWidth: 1,
        borderColor: COLORS.headerBorder, // Use light border for separation
        paddingVertical: 15,
        marginBottom: 10, // Space below each row before button
    },
    rowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    removeButton: {
        padding: 5,
        // backgroundColor: 'rgba(220, 53, 69, 0.1)', // Optional subtle background
        borderRadius: 15,
    },
    rowContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        // alignItems: 'flex-end', // Align input groups at bottom if needed
    },
    rowInputGroup: {
        flex: 1, // Each group takes half the space
        marginHorizontal: 8, // Space between input groups
        // No marginBottom needed here if aligned at bottom
    },
    rowInput: { // Specific style for inputs inside rows
        // Inherits from 'input', but can override
        fontSize: 15,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8, // Slightly smaller padding
    },
    rowCalculation: {
        marginTop: 12,
        paddingTop: 10,
        // borderTopWidth: 1, // Removed top border, rely on row bottom border
        // borderTopColor: COLORS.headerBorder,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    calculationText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    positiveText: {
        color: COLORS.positive,
        fontWeight: '500',
    },
    negativeText: {
        color: COLORS.negative,
        fontWeight: '500',
    },
    noRowsText: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        paddingVertical: 15,
        marginBottom: 15,
    },
    // Buttons
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12, // Slightly smaller button
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: COLORS.primary, // Use primary color
        marginTop: 10, // Space above button
        elevation: 2,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textOnPrimary,
    },
    // Summary Section
    summaryCard: {
        marginTop: 10, // Add space if needed above summary
         // Can add specific border/background if needed
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12, // Consistent vertical padding
        borderBottomWidth: 1,
        borderBottomColor: COLORS.headerBorder, // Use light separator
        // Remove border for the last item if desired (using :last-child pseudo-selector isn't straightforward in RN StyleSheet)
    },
    summaryLabel: {
        fontSize: 15,
        color: COLORS.textSecondary,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    summaryIcon: {
        marginRight: 10, // Space between icon and label
    },
    // Sidebar Styles (Light Theme)
    sidebarInternal: {
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 300,
        backgroundColor: COLORS.headerBackground, // White background
        zIndex: 1000, elevation: 10, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.2, shadowRadius: 5,
        paddingTop: Platform.OS === 'ios' ? 20 : 0,
        borderRightWidth: 1, // Add border to separate from content
        borderRightColor: COLORS.headerBorder,
    },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 }, // Style if you add a logo
    sidebarTitleInternal: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center' }, // Dark text
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: {
        backgroundColor: COLORS.primaryLight, // Light blue highlight
    },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: COLORS.textSecondary, fontWeight: '500' }, // Darker text
    sidebarButtonTextActiveInternal: { color: COLORS.primary, fontWeight: 'bold' }, // Primary color for active text
});

export default TaxiFareCalculator;