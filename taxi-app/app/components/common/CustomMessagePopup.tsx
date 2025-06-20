import React, { useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    Platform
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

const { width } = Dimensions.get('window');

interface CustomMessagePopupProps {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onClose: () => void;
    duration?: number;
}

const iconMap = {
    success: { name: 'check-circle', color: colors.success },
    error: { name: 'error', color: colors.error },
    warning: { name: 'warning', color: colors.warning },
    info: { name: 'info', color: colors.primary },
};

const backgroundMap = {
    success: colors.successLight,
    error: colors.errorLight,
    warning: colors.warningLight,
    info: colors.primaryLight,
};

const textMap = {
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.primary,
};

const CustomMessagePopup: React.FC<CustomMessagePopupProps> = ({
    visible,
    message,
    type,
    onClose,
    duration
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;

        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                if (duration) {
                    timer = setTimeout(onClose, duration);
                }
            });
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: -100,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [visible]);

    if (!visible) return null;

    const { name: iconName, color: iconColor } = iconMap[type];
    const backgroundColor = backgroundMap[type];
    const textColor = textMap[type];

    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <Animated.View
                    style={[
                        styles.popup,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                            backgroundColor: backgroundColor,
                            borderColor: iconColor,
                        },
                    ]}
                    onStartShouldSetResponder={() => true}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    <View style={styles.row}>
                        <MaterialIcons name={iconName as any} size={28} color={iconColor} style={styles.icon} />
                        <Text style={[styles.message, { color: textColor }]}>
                            {message}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={20} color={iconColor} />
                    </TouchableOpacity>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingTop: Platform.OS === 'android' ? 60 : 40,
    },
    popup: {
        width: width * 0.92,
        paddingVertical: 18,
        paddingHorizontal: 15,
        borderRadius: 16,
        borderWidth: 1.2,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        backdropFilter: 'blur(10px)',
    },
    row: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'center',
        flexWrap: 'wrap',
        paddingRight: 10,
    },
    icon: {
        marginRight: 12,
    },
    message: {
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 22,
        flexShrink: 1,
    },
    closeBtn: {
        padding: 6,
    },
});

export default CustomMessagePopup;
