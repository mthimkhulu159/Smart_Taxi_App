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
    Platform,
    ViewStyle,
    TextStyle,
    Animated,
    Dimensions,
    Pressable, // Replaced TouchableWithoutFeedback for modern interaction
} from 'react-native';
// Keep icons - Ionicons for menu, Feather for general actions, MaterialCommunityIcons for specific ones
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // Using existing Sidebar component
import { RootStackParamList } from '../types/navigation'; // Adjust path if needed

// --- Constants ---
const COLORS = {
    // A more modern, clean, and slightly artistic light theme palette
    background: '#F0F4F8',          // Very light blue-gray for main background
    cardBackground: '#FFFFFF',      // Pure white for cards/elements that stand out
    cardBorder: '#E0E7ED',          // Subtle light gray border for depth
    shadow: 'rgba(50, 50, 93, 0.08)', // A slightly darker, more impactful shadow
    textPrimary: '#2F3C4C',         // Dark blue-gray for main headings and text
    textSecondary: '#627D98',       // Muted blue-gray for labels and secondary info
    textPlaceholder: '#9AAAB7',     // Soft gray for input placeholders
    primary: '#4A90E2',             // A vibrant, inviting blue for primary actions
    primaryLight: 'rgba(74, 144, 226, 0.15)', // Lighter tint of primary for backgrounds/highlights
    textOnPrimary: '#FFFFFF',       // White text for primary buttons
    inputBorder: '#CBD5E0',         // Soft gray for input field borders
    inputFocusBorder: '#4A90E2',    // Primary blue for focused input
    positive: '#5CB85C',            // Standard green for positive indicators
    negative: '#D9534F',            // Standard red for negative indicators
    headerBackground: '#FFFFFF',    // White header
    headerBorder: '#EBF1F6',        // Very light border for header
};

// --- Interfaces & Types ---
interface Row { id: number; numPeople: string; amountPaid: string; }
interface CalculatedRow extends Row { amountDueForRow: string; changeDueToRow: string; isChangePositive: boolean; }
interface CalculationResult { rowCalculations: CalculatedRow[]; totalReceived: string; totalChangePassengers: string; }

// Redefined Styles Interface with new properties for modern UI
interface ComponentStyles {
    safeArea: ViewStyle;
    container: ViewStyle;
    header: ViewStyle;
    headerButton: ViewStyle;
    headerTitle: TextStyle;
    scrollContent: ViewStyle;
    card: ViewStyle;
    cardTitle: TextStyle;
    inputGroup: ViewStyle;
    label: TextStyle;
    input: TextStyle;
    highlightTextContainer: ViewStyle; // Added for the total due box style
    highlightText: TextStyle;
    highlightAmount: TextStyle;      // Added for the highlighted amount within highlightText
    rowItem: ViewStyle;
    rowHeader: ViewStyle;
    rowTitle: TextStyle;
    removeButton: ViewStyle;
    rowContent: ViewStyle;
    rowInputGroup: ViewStyle;
    rowInput: TextStyle;
    rowCalculation: ViewStyle;
    calculationText: TextStyle;
    positiveText: TextStyle;
    negativeText: TextStyle;
    noRowsText: TextStyle;
    addButton: ViewStyle;
    addButtonText: TextStyle;
    summaryCard: ViewStyle;
    summaryRow: ViewStyle;
    summaryLastRow: ViewStyle; // Explicit style for the last summary row to remove bottom border
    summaryLabel: TextStyle;
    summaryValue: TextStyle;
    summaryIcon: TextStyle;
    // NOTE: Sidebar styles are NOT passed as props to avoid changing Sidebar.tsx
    // The previous error indicated that Sidebar.tsx did not expect these props.
    // Therefore, they are removed from the props list of the Sidebar component.
}

type TaxiFareCalculatorScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TaxiFareCalculator'>;

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
    const slideAnim = useRef(new Animated.Value(20)).current; // Subtle initial slide up

    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
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
        <SafeAreaView style={styles.safeArea}>
            {/* Sidebar component - NO STYLE PROPS PASSED as per user request */}
            <Sidebar
                isVisible={sidebarVisible}
                onClose={toggleSidebar}
                onNavigate={handleNavigate}
                activeScreen="TaxiFareCalculator"
            />

            <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}>
                        <Ionicons name="menu-outline" size={26} color={COLORS.textPrimary} /> {/* Modern outline icon */}
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Fare Calculator</Text>
                    <View style={styles.headerButton} />{/* Placeholder for symmetry */}
                </View>

                {/* Replaced TouchableWithoutFeedback with Pressable */}
                <Pressable onPress={Keyboard.dismiss} accessible={false} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                        {/* Card 1: Trip Details */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Trip Details</Text>

                            {/* Price per Person Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Price per Person (R)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={taxiPrice}
                                    onChangeText={handleSetTaxiPrice}
                                    keyboardType="numeric"
                                    placeholder="e.g., 15.50"
                                    placeholderTextColor={COLORS.textPlaceholder}
                                    selectionColor={COLORS.primary}
                                />
                            </View>

                            {/* Total Passengers Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Total Passengers</Text>
                                <TextInput
                                    style={styles.input}
                                    value={totalPassengers}
                                    onChangeText={handleSetTotalPassengers}
                                    keyboardType="numeric"
                                    placeholder="e.g., 4"
                                    placeholderTextColor={COLORS.textPlaceholder}
                                    selectionColor={COLORS.primary}
                                />
                            </View>

                            {/* Total Due Display (styled as a prominent highlight) */}
                            {totalAmountDueDriver > 0 && (
                                <View style={styles.highlightTextContainer}>
                                    <Text style={styles.highlightText}>
                                        Total Due to Driver: <Text style={styles.highlightAmount}>R {totalAmountDueDriver.toFixed(2)}</Text>
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Card 2: Payments Received */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Payments Received</Text>

                            {calculations.rowCalculations.length === 0 && (
                                <Text style={styles.noRowsText}>
                                    No payments recorded yet. Tap "Add Seat Row" below.
                                </Text>
                            )}

                            {calculations.rowCalculations.map((row, index) => (
                                <View key={row.id} style={styles.rowItem}>
                                    <View style={styles.rowHeader}>
                                        <Text style={styles.rowTitle}>Row {index + 1}</Text>
                                        <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveRow(row.id)}>
                                            <Feather name="minus-circle" size={20} color={COLORS.negative} /> {/* Modern removal icon */}
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
                                            <Text style={styles.calculationText}>
                                                Due: <Text style={{ fontWeight: '600', color: COLORS.textPrimary }}>R {row.amountDueForRow}</Text>
                                            </Text>
                                            <Text style={[styles.calculationText, row.isChangePositive ? styles.positiveText : styles.negativeText]}>
                                                Change: <Text style={{ fontWeight: '600' }}>R {row.changeDueToRow}</Text>
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ))}

                            {/* Add Passenger Button */}
                            <TouchableOpacity style={styles.addButton} onPress={handleAddRow}>
                                <Feather name="plus-circle" size={18} color={COLORS.textOnPrimary} style={{ marginRight: 8 }} />
                                <Text style={styles.addButtonText}>Add Seat Row</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Card 3: Trip Summary */}
                        {rows.length > 0 && (
                            <View style={[styles.card, styles.summaryCard]}>
                                <Text style={styles.cardTitle}>Trip Summary</Text>
                                {/* Total Received */}
                                <View style={styles.summaryRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Feather name="trending-up" size={20} color={COLORS.positive} style={styles.summaryIcon} /> {/* Changed icon */}
                                        <Text style={styles.summaryLabel}>Total Received:</Text>
                                    </View>
                                    <Text style={styles.summaryValue}>R {calculations.totalReceived}</Text>
                                </View>
                                {/* Total Change Due */}
                                <View style={styles.summaryRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Feather name="repeat" size={20} color={COLORS.textSecondary} style={styles.summaryIcon} /> {/* Changed icon */}
                                        <Text style={styles.summaryLabel}>Total Change Due:</Text>
                                    </View>
                                    <Text style={[styles.summaryValue, styles.positiveText]}>R {calculations.totalChangePassengers}</Text>
                                </View>
                                {/* Net Balance */}
                                <View style={[styles.summaryRow, styles.summaryLastRow]}> {/* Applying summaryLastRow here */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <MaterialCommunityIcons name="wallet-outline" size={20} color={COLORS.textPrimary} style={styles.summaryIcon} />
                                        <Text style={styles.summaryLabel}>Net Balance:</Text>
                                    </View>
                                    <Text style={[styles.summaryValue,
                                    (parseFloat(calculations.totalReceived) - totalAmountDueDriver) >= 0
                                        ? styles.positiveText // Positive means driver received enough/more
                                        : styles.negativeText // Negative means driver is owed
                                    ]}>
                                        R {(parseFloat(calculations.totalReceived) - totalAmountDueDriver).toFixed(2)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </Pressable>
            </Animated.View>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create<ComponentStyles>({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background, // Applies the new light blue-gray background
    },
    container: {
        flex: 1,
    },
    // Header Styles
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20, // Increased padding
        paddingTop: Platform.OS === 'android' ? 20 : 15, // Adjusted for platform consistency
        paddingBottom: 15,
        backgroundColor: COLORS.headerBackground,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.headerBorder,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    headerButton: {
        padding: 8, // More generous touch area
        minWidth: 44, // Ensures minimum touch target size
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22, // Larger, more prominent title
        fontWeight: '700', // Bolder
        color: COLORS.textPrimary,
    },
    // Scroll Content & Cards
    scrollContent: {
        padding: 20, // Consistent padding around cards
        paddingBottom: 40,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: 16, // More rounded, modern look
        padding: 24, // Generous internal padding
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 6 }, // More noticeable shadow
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 6,
    },
    cardTitle: {
        fontSize: 20, // Slightly larger card titles
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 20,
        paddingBottom: 5, // Space between title and content/separator if active
    },
    // Input Fields
    inputGroup: {
        marginBottom: 20, // Consistent spacing between input groups
    },
    label: {
        fontSize: 16, // Slightly larger labels
        color: COLORS.textSecondary,
        marginBottom: 8,
        fontWeight: '600',
    },
    input: {
        backgroundColor: 'transparent', // Transparent background to let the card background show
        borderBottomWidth: 2, // Thicker underline for emphasis
        borderColor: COLORS.inputBorder,
        borderRadius: 0,
        paddingHorizontal: 0,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        fontSize: 18, // Larger input text
        color: COLORS.textPrimary,
    },
    // Highlight Text for Total Due Driver
    highlightTextContainer: {
        backgroundColor: COLORS.primaryLight,
        borderRadius: 10, // Rounded corners for the highlight box
        paddingVertical: 18, // More vertical padding
        paddingHorizontal: 20,
        marginTop: 25, // More margin to separate from inputs
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5, // Slightly thicker border for emphasis
        borderColor: COLORS.primary,
        shadowColor: COLORS.shadow, // Subtle shadow for the highlight box
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    highlightText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    highlightAmount: {
        fontSize: 22, // Larger amount for strong emphasis
        fontWeight: '800', // Extra bold
        color: COLORS.primary,
    },
    // Row Item Styles (Payments Received Section)
    rowItem: {
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderColor: COLORS.headerBorder, // Subtle separator
        paddingVertical: 18,
        marginBottom: 15, // More space between rows
    },
    rowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    rowTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    removeButton: {
        padding: 5,
    },
    rowContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10, // Space between inputs and calculations in row
    },
    rowInputGroup: {
        flex: 1,
        marginHorizontal: 8,
        alignItems: 'flex-start',
    },
    rowInput: {
        borderBottomWidth: 1.5, // Consistent underline style
        borderColor: COLORS.inputBorder,
        borderRadius: 0,
        paddingHorizontal: 0,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        fontSize: 16,
        color: COLORS.textPrimary,
        width: '100%',
    },
    rowCalculation: {
        marginTop: 10, // Consistent with rowContent marginBottom
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8, // Aligns with input text
    },
    calculationText: {
        fontSize: 15,
        color: COLORS.textSecondary,
    },
    positiveText: {
        color: COLORS.positive,
        fontWeight: '600',
    },
    negativeText: {
        color: COLORS.negative,
        fontWeight: '600',
    },
    noRowsText: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        paddingVertical: 25, // More vertical padding
        marginBottom: 15,
        fontSize: 16,
    },
    // Button Styles
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16, // More vertical padding for a substantial button
        paddingHorizontal: 30,
        borderRadius: 10,
        backgroundColor: COLORS.primary,
        marginTop: 25, // More margin from content above
        elevation: 4, // Increased elevation for a lifted effect
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    addButtonText: {
        fontSize: 18, // Larger text
        fontWeight: '700',
        color: COLORS.textOnPrimary,
    },
    // Summary Section Styles
    summaryCard: {
        marginTop: 20, // Consistent top margin for cards
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16, // More vertical padding for summary rows
        borderBottomWidth: 1,
        borderBottomColor: COLORS.headerBorder,
    },
    summaryLastRow: {
        borderBottomWidth: 0, // Ensures no border on the very last summary item
    },
    summaryLabel: {
        fontSize: 17,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    summaryIcon: {
        marginRight: 12, // More space for icons
    },
    // Removed sidebarInternal styles as per user request to not change Sidebar code
    // If you later decide to allow passing styles to Sidebar, these styles
    // would be defined and passed from here.
});

export default TaxiFareCalculator;
