import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  RefreshControl, 
  SafeAreaView,
  Platform 
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { productApi } from '../services/api';

interface Product {
  id: string;
  name: string;
  displayName: string;
  priceINR: number;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNLISTED';
  primaryImageUrl: string;
  listedAt: string;
  imageCount: number;
}

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const fetchRecentProducts = async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setError('');
    try {
      const response = await productApi.recent();
      setProducts(response.data.products || []);
    } catch (err: any) {
      console.error('Fetch products error:', err);
      setError('Could not retrieve recent items. Swipe down to retry.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecentProducts();
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchRecentProducts(false);
  }, []);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('admin_token');
    router.replace('/login');
  };

  const getStatusBadge = (status: Product['status']) => {
    let color = '#7a6f5e';
    let text: string = status;

    if (status === 'AVAILABLE') {
      color = '#2D7A3A';
      text = 'Live';
    } else if (status === 'RESERVED') {
      color = '#C9A84C';
      text = 'Reserved';
    } else if (status === 'SOLD') {
      color = '#B91C1C';
      text = 'Sold Out';
    } else if (status === 'UNLISTED') {
      color = '#4b5563';
      text = 'Draft';
    }

    return (
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{text}</Text>
      </View>
    );
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    // Standard backend imageUrl might be /images/products/...
    // Let's resolve the URL against the BASE_URL
    const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
    const imageUrl = item.primaryImageUrl
      ? (item.primaryImageUrl.startsWith('http') ? item.primaryImageUrl : `${BASE_URL}${item.primaryImageUrl}`)
      : null;

    return (
      <TouchableOpacity 
        style={styles.itemRow}
        onPress={() => {
          // If draft, can go to preview
          if (item.status === 'UNLISTED') {
            // Need a dummy jobId or resolve how to preview a draft
            // If they click on it, we can just navigate or let them re-enhance
          }
        }}
        activeOpacity={0.8}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.noImage]}>
            <Text style={styles.noImageText}>💍</Text>
          </View>
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.displayName || item.name}
          </Text>
          <Text style={styles.itemPrice}>₹{item.priceINR.toLocaleString('en-IN')}</Text>
          <Text style={styles.itemMeta}>
            Images: {item.imageCount} • {new Date(item.listedAt).toLocaleDateString()}
          </Text>
        </View>
        {getStatusBadge(item.status)}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom elegant header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Rajshree Jewels</Text>
          <Text style={styles.headerTitle}>Seller Control</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderProductItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#C9A84C"
            colors={['#C9A84C']}
          />
        }
        ListHeaderComponent={
          <View style={styles.ctaContainer}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => router.push('/new-listing')}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>＋ New Jewellery Listing</Text>
            </TouchableOpacity>
            
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Ingestions</Text>
              <TouchableOpacity onPress={() => fetchRecentProducts(true)}>
                <Text style={styles.refreshLink}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color="#C9A84C" size="large" style={styles.loader} />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>💍 No items listed recently</Text>
              <Text style={styles.emptySubtext}>Tap the button above to upload your first piece</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFAF5', // Warm elegant luxury off-white
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#1a1a1a', // Near black header
    borderBottomWidth: 1,
    borderColor: '#C9A84C',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#E8C97A',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#7a6f5e',
    borderRadius: 4,
  },
  logoutText: {
    fontSize: 12,
    color: '#a09689',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 40,
  },
  ctaContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    shadowColor: '#1a1a1a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#E8C97A',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  refreshLink: {
    fontSize: 13,
    color: '#C9A84C',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2D9C8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#FDFAF5',
    borderWidth: 1,
    borderColor: '#E2D9C8',
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  itemPrice: {
    fontSize: 14,
    color: '#C9A84C',
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 11,
    color: '#7a6f5e',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7a6f5e',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
