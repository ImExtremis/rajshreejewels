import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Share, 
  Alert, 
  SafeAreaView, 
  Platform 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
// Import removed to fix compilation

export default function PublishedScreen() {
  const { displayName, productId } = useLocalSearchParams<{ displayName: string; productId: string }>();
  const router = useRouter();

  // Animated scaling state
  const scaleValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Zoom checkmark animation on mount
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleShareLink = async () => {
    // Standard frontend format: shop/[slug]
    // Since slug is generated in DB, let's look up how we can share the shop URL
    // We can assume slug format or link to shop page
    const BASE_FRONTEND = 'https://rajshreejewels.com'; // Fallback matching production domains
    const shopUrl = `${BASE_FRONTEND}/shop`;

    try {
      await Share.share({
        message: `Check out our new jewellery piece: "${displayName || 'New Arrival'}" now live on our store!\nShop here: ${shopUrl}`,
        title: 'New Listing Live!',
      });
    } catch (err: any) {
      console.error('Share failure:', err);
      Alert.alert('Sharing Failure', 'Unable to open share sheet.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Native Scale animation circle checkmark */}
        <Animated.View 
          style={[
            styles.successCircle, 
            { 
              transform: [{ scale: scaleValue }],
              opacity: opacityValue
            }
          ]}
        >
          <Text style={styles.successIcon}>✓</Text>
        </Animated.View>

        <Animated.Text style={[styles.title, { opacity: opacityValue }]}>
          Item is now live! 🎉
        </Animated.Text>
        
        <Animated.Text style={[styles.productName, { opacity: opacityValue }]} numberOfLines={2}>
          {displayName}
        </Animated.Text>
        
        <Animated.Text style={[styles.subtitle, { opacity: opacityValue }]}>
          AI optimization completed. Background has been cleaned up, and the listing has been catalogued in your store database.
        </Animated.Text>

        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleShareLink}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>🔗 Share Store Link</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => router.replace('/new-listing')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>＋ List Another Item</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.homeLink} 
          onPress={() => router.replace('/')}
        >
          <Text style={styles.homeLinkText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFAF5',
    justifyContent: 'center',
    padding: 24,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2D7A3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#2D7A3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  successIcon: {
    fontSize: 54,
    color: '#ffffff',
    fontWeight: 'bold',
    lineHeight: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C9A84C',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 22,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 13,
    color: '#7a6f5e',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 44,
  },
  actionContainer: {
    width: '100%',
    paddingHorizontal: 12,
  },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#E8C97A',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: '#C9A84C',
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  secondaryButtonText: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  homeLink: {
    paddingVertical: 12,
  },
  homeLinkText: {
    color: '#7a6f5e',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
