import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors'; // Adjust path as needed

const { height } = Dimensions.get('window');

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

const styles = StyleSheet.create({
    loadingGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? 25 : 0,
    },
    loadingContainerInternal: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: 15,
        padding: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 8,
    },
    loadingTextInternal: {
        marginTop: 15,
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
});

export default Loading;