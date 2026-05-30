import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Modal, 
  ActivityIndicator, 
  Alert, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { listingApi } from '../services/api';

// Enums exactly matching backend
const CATEGORIES = ['NECKLACE', 'EARRINGS', 'BANGLES', 'BRACELET', 'RING', 'ANKLET', 'MAANG_TIKKA', 'NOSE_PIN', 'PENDANT', 'SET', 'OTHER'];
const METALS = ['GOLD_1GRAM', 'SILVER', 'BRASS', 'COPPER', 'ALLOY', 'NONE'];
const FINISHES = ['GOLD_POLISH', 'SILVER_POLISH', 'ANTIQUE', 'MATTE', 'RHODIUM', 'OXIDISED', 'MEENAKARI', 'KUNDAN', 'NONE'];

export default function NewListingScreen() {
  const router = useRouter();

  // Form State
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('NECKLACE');
  const [metal, setMetal] = useState('NONE');
  const [finish, setFinish] = useState('NONE');
  const [weight, setWeight] = useState('');
  const [stoneType, setStoneType] = useState('');
  const [occasion, setOccasion] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');

  // Dropdown UI Modal States
  const [activePicker, setActivePicker] = useState<'category' | 'metal' | 'finish' | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Photo Ingestion
  const handleSelectImage = async () => {
    if (images.length >= 6) {
      Alert.alert('Limit Reached', 'You can upload a maximum of 6 images.');
      return;
    }

    Alert.alert(
      'Add Image',
      'Choose source',
      [
        {
          text: 'Camera Roll',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera roll access is required to choose photos.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsMultipleSelection: true,
              selectionLimit: 6 - images.length
            });
            if (!result.canceled && result.assets) {
              const selected = result.assets.map(asset => asset.uri);
              setImages(prev => [...prev, ...selected].slice(0, 6));
            }
          }
        },
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera access is required to take photos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8
            });
            if (!result.canceled && result.assets) {
              setImages(prev => [...prev, result.assets[0].uri].slice(0, 6));
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Submit Ingestion
  const handleEnhance = async () => {
    // Client-side Validations
    if (images.length === 0) {
      Alert.alert('Photo Required', 'Please select at least 1 image.');
      return;
    }
    if (!name || name.trim().length < 3) {
      Alert.alert('Name Required', 'Product name must be at least 3 characters.');
      return;
    }
    const numPrice = parseInt(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid positive price.');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('category', category);
      formData.append('metal', metal);
      formData.append('finish', finish);
      
      if (weight.trim()) formData.append('weightGrams', weight.trim());
      if (stoneType.trim()) formData.append('stoneType', stoneType.trim());
      if (occasion.trim()) formData.append('occasion', occasion.trim());
      
      formData.append('priceINR', price.trim());
      if (originalPrice.trim()) formData.append('originalPriceINR', originalPrice.trim());

      // Append raw images as file buffers
      images.forEach((uri, index) => {
        const fileExt = uri.split('.').pop() || 'jpg';
        formData.append('images', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          type: `image/${fileExt === 'png' ? 'png' : fileExt === 'webp' ? 'webp' : 'jpeg'}`,
          name: `img_${index}.${fileExt}`
        } as any);
      });

      const response = await listingApi.create(formData);
      const { jobId, productId } = response.data;
      
      // Navigate to polling screen
      router.push({
        pathname: '/preview',
        params: { jobId, productId }
      });
    } catch (err: any) {
      console.error('Enhance ingestion error:', err);
      const msg = err.response?.data?.error || 'Ingestion failed. Ensure network endpoint is reachable.';
      Alert.alert('Ingestion Error', msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Picker sheet selection
  const openSelectionSheet = (picker: 'category' | 'metal' | 'finish') => {
    setActivePicker(picker);
  };

  const getOptionsList = () => {
    if (activePicker === 'category') return CATEGORIES;
    if (activePicker === 'metal') return METALS;
    if (activePicker === 'finish') return FINISHES;
    return [];
  };

  const selectOption = (opt: string) => {
    if (activePicker === 'category') setCategory(opt);
    if (activePicker === 'metal') setMetal(opt);
    if (activePicker === 'finish') setFinish(opt);
    setActivePicker(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Section: Photos Ingestion (Row of slots) */}
          <Text style={styles.sectionHeader}>Product Photography</Text>
          <View style={styles.photoContainer}>
            {images.map((uri, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.photoSlot} 
                onPress={() => handleRemoveImage(index)}
              >
                <Image source={{ uri }} style={styles.image} />
                <View style={styles.deleteBadge}>
                  <Text style={styles.deleteText}>×</Text>
                </View>
              </TouchableOpacity>
            ))}
            {images.length < 6 ? (
              <TouchableOpacity style={[styles.photoSlot, styles.emptySlot]} onPress={handleSelectImage}>
                <Text style={styles.slotPlus}>＋</Text>
                <Text style={styles.slotText}>Add Image</Text>
                <Text style={styles.slotCount}>{images.length}/6</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.hintText}>* Selected images. Tap a thumbnail to remove. First is primary.</Text>

          {/* Section: Basic Metadata fields */}
          <Text style={styles.sectionHeader}>Specifications</Text>
          
          <Text style={styles.inputLabel}>Item Name (Raw)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Kundan necklace set with rubies"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#9ca3af"
          />

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => openSelectionSheet('category')}>
                <Text style={styles.pickerTriggerText}>{category.replace('_', ' ')}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>Metal Base</Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => openSelectionSheet('metal')}>
                <Text style={styles.pickerTriggerText}>{metal.replace('_', ' ')}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>Polish Finish</Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => openSelectionSheet('finish')}>
                <Text style={styles.pickerTriggerText}>{finish.replace('_', ' ')}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>Weight (Grams)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 14.5"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Stone / Stone Details</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Kundan, red ruby glass beads"
            value={stoneType}
            onChangeText={setStoneType}
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.inputLabel}>Occasion Wear</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Bridal, Festive, Engagement"
            value={occasion}
            onChangeText={setOccasion}
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.sectionHeader}>Pricing Information</Text>

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>Selling Price (₹)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="₹1250"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.halfCol}>
              <Text style={styles.inputLabel}>Original Price (₹)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="₹1850 (Optional)"
                value={originalPrice}
                onChangeText={setOriginalPrice}
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
          {originalPrice ? <Text style={styles.helperText}>This will show as a strikethrough discount price.</Text> : null}

          {/* Ingest button */}
          <TouchableOpacity 
            style={[styles.primaryButton, isUploading && styles.primaryButtonDisabled]} 
            onPress={handleEnhance}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#1a1a1a" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Enhance & Preview Listing →</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Sheet Custom Picker Modal */}
      <Modal
        visible={activePicker !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {activePicker === 'category' ? 'Category' : activePicker === 'metal' ? 'Metal' : 'Finish'}
              </Text>
              <TouchableOpacity onPress={() => setActivePicker(null)}>
                <Text style={styles.modalCloseLink}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.optionsList}>
              {getOptionsList().map((opt) => (
                <TouchableOpacity 
                  key={opt} 
                  style={styles.optionRow} 
                  onPress={() => selectOption(opt)}
                >
                  <Text style={styles.optionText}>{opt.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
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
    padding: 24,
    paddingBottom: 60,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#E2D9C8',
    paddingBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  photoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  photoSlot: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2D9C8',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  emptySlot: {
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPlus: {
    fontSize: 24,
    color: '#C9A84C',
  },
  slotText: {
    fontSize: 10,
    color: '#7a6f5e',
    fontWeight: '500',
    marginTop: 2,
  },
  slotCount: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  deleteBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  hintText: {
    fontSize: 10,
    color: '#7a6f5e',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: '#1a1a1a',
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2D9C8',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfCol: {
    flex: 1,
    marginBottom: 0,
  },
  pickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2D9C8',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerTriggerText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  pickerArrow: {
    fontSize: 10,
    color: '#7a6f5e',
  },
  helperText: {
    fontSize: 11,
    color: '#7a6f5e',
    marginTop: -8,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#C9A84C',
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  primaryButtonDisabled: {
    backgroundColor: '#7a642e',
  },
  primaryButtonText: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#E2D9C8',
    paddingBottom: 14,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalCloseLink: {
    color: '#C9A84C',
    fontWeight: '600',
  },
  optionsList: {
    marginBottom: 20,
  },
  optionRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#FDFAF5',
  },
  optionText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
});
