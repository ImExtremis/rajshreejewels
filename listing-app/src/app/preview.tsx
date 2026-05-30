import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  Animated, 
  Modal, 
  TextInput, 
  Dimensions, 
  Alert, 
  SafeAreaView, 
  Platform,
  KeyboardAvoidingView 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listingApi } from '../services/api';

const { width } = Dimensions.get('window');

interface PreviewData {
  displayName: string;
  shortDesc: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  images: { urlThumb: string; urlMedium: string }[];
}

export default function PreviewScreen() {
  const { jobId, productId } = useLocalSearchParams<{ jobId: string; productId: string }>();
  const router = useRouter();

  // Status and data state
  const [status, setStatus] = useState<'pending' | 'processing' | 'done' | 'failed'>('pending');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Custom manual overrides state
  const [editedName, setEditedName] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);

  // Animated shimmer pulse
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  // Poll job status every 3 seconds
  useEffect(() => {
    if (!jobId) return;

    let pollInterval: any;

    const checkJobStatus = async () => {
      try {
        const response = await listingApi.status(jobId);
        const { status: jobStatus, preview, error } = response.data;

        if (jobStatus === 'done' && preview) {
          setStatus('done');
          setPreviewData(preview);
          setEditedName(preview.displayName);
          setEditedDesc(preview.description);
          clearInterval(pollInterval);
        } else if (jobStatus === 'failed') {
          setStatus('failed');
          setErrorMessage(error || 'AI enhancement encountered a failure.');
          clearInterval(pollInterval);
        } else {
          setStatus(jobStatus); // 'pending' or 'processing'
        }
      } catch (err: any) {
        console.error('Status poll error:', err);
        // Do not crash, let the polling retry in case of intermittent network drops
      }
    };

    // First trigger immediately
    checkJobStatus();
    pollInterval = setInterval(checkJobStatus, 3000);

    return () => clearInterval(pollInterval);
  }, [jobId]);

  // Pulse animation loop
  useEffect(() => {
    if (status === 'pending' || status === 'processing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.9,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
    }
  }, [status]);

  // Bottom action triggers
  const handlePublish = async () => {
    if (!productId) return;
    setIsActionLoading(true);
    try {
      await listingApi.publish(productId, {
        displayName: editedName,
        description: editedDesc
      });
      
      router.push({
        pathname: '/published',
        params: { displayName: editedName, productId }
      });
    } catch (err: any) {
      console.error('Publish error:', err);
      Alert.alert('Publish Error', err.response?.data?.error || 'Failed to publish listing.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReEnhance = async () => {
    if (!productId) return;
    setIsActionLoading(true);
    try {
      const response = await listingApi.reEnhance(productId);
      const { jobId: newJobId } = response.data;
      
      // Reset statuses and restart polling by pointing back to new jobId
      setStatus('pending');
      setPreviewData(null);
      setErrorMessage('');
      router.setParams({ jobId: newJobId });
    } catch (err: any) {
      console.error('Re-enhance error:', err);
      Alert.alert('AI Queue Error', 'Could not queue re-enhancement.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Rendering Loading View
  if (status === 'pending' || status === 'processing') {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.shimmerLogo, { opacity: pulseAnim }]}>
          <Text style={styles.shimmerEmoji}>✨</Text>
        </Animated.View>
        <Text style={styles.loadingText}>AI is polishing your listing...</Text>
        <Text style={styles.loadingSubtext}>
          {status === 'pending' 
            ? 'Ingesting files and waiting for processor...' 
            : 'OpenAI GPT is writing copies and correcting lighting...'}
        </Text>
        <ActivityIndicator color="#C9A84C" size="small" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // Rendering Failed View
  if (status === 'failed') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorHeader}>⚠️ Ingestion Enhancement Failed</Text>
        <Text style={styles.errorSub}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleReEnhance}>
          <Text style={styles.retryButtonText}>Retry Enhancement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/')}>
          <Text style={styles.backLinkText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

  // Rendering Preview UI Panel
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Horizontal Carousel */}
        {previewData?.images && previewData.images.length > 0 ? (
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
          >
            {previewData.images.map((img, index) => {
              const fullUrl = img.urlMedium.startsWith('http') ? img.urlMedium : `${BASE_URL}${img.urlMedium}`;
              return (
                <Image 
                  key={index} 
                  source={{ uri: fullUrl }} 
                  style={styles.carouselImage} 
                  resizeMode="cover"
                />
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.carouselPlaceholder}>
            <Text style={styles.carouselPlaceholderText}>💍 Images processing</Text>
          </View>
        )}

        <View style={styles.metaContainer}>
          <Text style={styles.displayName}>{editedName}</Text>
          <Text style={styles.shortDesc}>{previewData?.shortDesc}</Text>

          <Text style={styles.labelHeader}>AI Product Story</Text>
          <Text style={styles.description}>{editedDesc}</Text>

          {/* Keywords Pill tags */}
          <Text style={styles.labelHeader}>SEO Keywords</Text>
          <View style={styles.keywordsContainer}>
            {previewData?.keywords?.map((word, idx) => (
              <View key={idx} style={styles.keywordPill}>
                <Text style={styles.keywordText}>#{word}</Text>
              </View>
            ))}
          </View>

          {/* Accordion Google preview */}
          <TouchableOpacity 
            style={styles.accordionHeader} 
            onPress={() => setSeoOpen(!seoOpen)}
            activeOpacity={0.8}
          >
            <Text style={styles.accordionTitle}>🔍 Google Search Preview</Text>
            <Text style={styles.accordionArrow}>{seoOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {seoOpen && previewData ? (
            <View style={styles.seoPreviewBox}>
              <Text style={styles.googleUrl}>https://rajshreejewels.com › shop</Text>
              <Text style={styles.googleTitle} numberOfLines={1}>{previewData.metaTitle}</Text>
              <Text style={styles.googleDesc} numberOfLines={2}>
                {previewData.metaDescription || editedDesc}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Primary bottom control rows */}
      <View style={styles.bottomBar}>
        <View style={styles.row}>
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => setIsEditModalOpen(true)}
            disabled={isActionLoading}
          >
            <Text style={styles.secondaryButtonText}>📝 Edit Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={handleReEnhance}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <ActivityIndicator color="#C9A84C" size="small" />
            ) : (
              <Text style={styles.secondaryButtonText}>✨ Re-enhance</Text>
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[styles.primaryButton, isActionLoading && styles.primaryButtonDisabled]} 
          onPress={handlePublish}
          disabled={isActionLoading}
        >
          {isActionLoading ? (
            <ActivityIndicator color="#1a1a1a" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Publish Live In Store ✓</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Manual edits overrides modal */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Refine Copywriting</Text>
                <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                  <Text style={styles.modalCloseLink}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={styles.modalLabel}>Display Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editedName}
                  onChangeText={setEditedName}
                  multiline
                />

                <Text style={styles.modalLabel}>Description Details</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalAreaInput]}
                  value={editedDesc}
                  onChangeText={setEditedDesc}
                  multiline
                  numberOfLines={6}
                />
              </ScrollView>

              <TouchableOpacity 
                style={styles.modalSaveButton} 
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.modalSaveText}>Save Modifications</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFAF5',
  },
  scrollContent: {
    paddingBottom: 150,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 24,
  },
  shimmerLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#262626',
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  shimmerEmoji: {
    fontSize: 36,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E8C97A',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loadingSubtext: {
    fontSize: 13,
    color: '#a09689',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  errorHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSub: {
    fontSize: 14,
    color: '#a09689',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#C9A84C',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryButtonText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
    fontSize: 14,
  },
  backLink: {
    paddingVertical: 10,
  },
  backLinkText: {
    color: '#a09689',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  carousel: {
    width: width,
    height: width,
    backgroundColor: '#ffffff',
  },
  carouselImage: {
    width: width,
    height: width,
  },
  carouselPlaceholder: {
    width: width,
    height: width,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselPlaceholderText: {
    color: '#7a6f5e',
    fontSize: 16,
  },
  metaContainer: {
    padding: 24,
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 28,
    marginBottom: 6,
  },
  shortDesc: {
    fontSize: 14,
    color: '#7a6f5e',
    fontStyle: 'italic',
    marginBottom: 20,
    lineHeight: 18,
  },
  labelHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#C9A84C',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 22,
    textAlign: 'justify',
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  keywordPill: {
    backgroundColor: '#E2D9C8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  keywordText: {
    fontSize: 11,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2D9C8',
    borderRadius: 8,
    padding: 16,
    marginTop: 28,
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  accordionArrow: {
    fontSize: 10,
    color: '#7a6f5e',
  },
  seoPreviewBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E2D9C8',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 16,
  },
  googleUrl: {
    fontSize: 11,
    color: '#4b5563',
    marginBottom: 2,
  },
  googleTitle: {
    fontSize: 16,
    color: '#1a0dab',
    fontWeight: '500',
    marginBottom: 4,
  },
  googleDesc: {
    fontSize: 12,
    color: '#4d5156',
    lineHeight: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#C9A84C',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#C9A84C',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#E8C97A',
    fontWeight: 'bold',
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: '#C9A84C',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#7a642e',
  },
  primaryButtonText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#E2D9C8',
    paddingBottom: 14,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalCloseLink: {
    color: '#ef4444',
    fontWeight: '600',
  },
  modalLabel: {
    fontSize: 12,
    color: '#7a6f5e',
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2D9C8',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 16,
    backgroundColor: '#FDFAF5',
  },
  modalAreaInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  modalSaveButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  modalSaveText: {
    color: '#E8C97A',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
