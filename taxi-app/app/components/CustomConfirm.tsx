// components/CustomConfirm.tsx
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomConfirmProps {
    visible: boolean;
    message: string;
    onCancel: () => void;  // Action for cancel button
    onConfirm: () => void; // Action for confirm button
}

const CustomConfirm: React.FC<CustomConfirmProps> = ({ visible, message, onCancel, onConfirm }) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current; // Fade-in animation
    const translateYAnim = React.useRef(new Animated.Value(200)).current; // Slide-up animation

    // When the popup is visible, start the fade and slide animations
    React.useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
                easing: Easing.out(Easing.ease),
            }).start();

            Animated.timing(translateYAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
                easing: Easing.out(Easing.ease),
            }).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
                easing: Easing.in(Easing.ease),
            }).start();

            Animated.timing(translateYAnim, {
                toValue: 200,
                duration: 500,
                useNativeDriver: true,
                easing: Easing.in(Easing.ease),
            }).start();
        }
    }, [visible]);

    return (
        <Modal
            animationType="none"
            transparent={true}
            visible={visible}
            onRequestClose={onCancel}
        >
            <View style={styles.modalOverlay}>
                <Animated.View
                    style={[
                        styles.modalContent,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: translateYAnim }],
                        },
                    ]}
                >
                    {/* Confirmation Icon */}
                    <Ionicons name="alert-circle" size={60} color="#F44336" />

                    {/* Confirmation Message */}
                    <Text style={styles.message}>{message}</Text>

                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onConfirm} style={styles.confirmButton}>
                            <Text style={styles.buttonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Dimmed background
    },
    modalContent: {
        width: '80%',
        padding: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#E4E4E4',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10, // For Android
    },
    message: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
        marginVertical: 20,
        lineHeight: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        marginRight: 10,
        paddingVertical: 12,
        backgroundColor: '#F44336',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButton: {
        flex: 1,
        marginLeft: 10,
        paddingVertical: 12,
        backgroundColor: '#4CAF50',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CustomConfirm;
