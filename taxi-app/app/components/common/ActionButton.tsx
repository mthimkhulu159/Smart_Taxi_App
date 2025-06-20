import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors'; // Adjust path as needed

interface ActionButtonProps {
    onPress: () => void;
    title: string;
    iconName?: keyof typeof Ionicons.glyphMap | keyof typeof MaterialIcons.glyphMap | keyof typeof FontAwesome.glyphMap;
    iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome';
    color?: string;
    textColor?: string;
    loading?: boolean;
    style?: ViewStyle;
    disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
    onPress,
    title,
    iconName,
    iconFamily = 'Ionicons',
    color = colors.primary,
    textColor = colors.white,
    loading = false,
    style = {},
    disabled = false,
}) => {
    const IconComponent =
        iconFamily === 'MaterialIcons'
            ? MaterialIcons
            : iconFamily === 'FontAwesome'
            ? FontAwesome
            : Ionicons;
    const isDisabled = disabled || loading;

    const handlePress = () => {
        if (onPress && !isDisabled) {
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
                    {iconName && (
                        <IconComponent
                            name={iconName as any} // Type assertion because of the union type for iconName
                            size={18}
                            color={textColor}
                            style={styles.actionButtonIcon}
                        />
                    )}
                    <Text style={[styles.actionButtonText, { color: textColor }]}>{title}</Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    actionButtonBase: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    actionButtonIcon: {
        marginRight: 10,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ActionButton;