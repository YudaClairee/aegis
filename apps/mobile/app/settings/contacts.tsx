import { useState } from 'react';
import { View, Text, Alert, ActivityIndicator, FlatList, Pressable, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { useContacts } from '../../src/hooks/useContacts';
import { useContactLinks } from '../../src/hooks/useContactLinks';
import { TextField } from '../../src/components/ui/TextField';
import { Button } from '../../src/components/ui/Button';
import type { EmergencyContact } from '@aegis/shared';

const RELATIONSHIPS = [
  { label: 'Orang Tua', value: 'parent' },
  { label: 'Saudara', value: 'sibling' },
  { label: 'Pasangan', value: 'partner' },
  { label: 'Teman', value: 'friend' },
  { label: 'Lainnya', value: 'other' },
];

export default function ContactsPage() {
  const {
    contacts,
    isLoading,
    isError,
    error,
    createContact,
    updateContact,
    deleteContact,
    setPrimaryContact,
  } = useContacts();

  const { generateInviteCode, isGeneratingInvite } = useContactLinks();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('friend');
  const [isPrimary, setIsPrimary] = useState(false);

  const openAddModal = () => {
    setEditingContact(null);
    setName('');
    setPhone('');
    setRelationship('friend');
    setIsPrimary(contacts.length === 0); // Default to primary if it's the first contact
    setModalVisible(true);
  };

  const openEditModal = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setName(contact.name);
    setPhone(contact.phone);
    setRelationship(contact.relationship || 'friend');
    setIsPrimary(contact.isPrimary);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Nama dan nomor telepon wajib diisi.');
      return;
    }

    try {
      if (editingContact) {
        await updateContact({
          id: editingContact.id,
          name,
          phone,
          relationship,
          isPrimary,
        });
      } else {
        await createContact({
          name,
          phone,
          relationship,
          isPrimary,
        });
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Gagal menyimpan', err.message);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Hapus Kontak',
      `Apakah Anda yakin ingin menghapus ${name} dari daftar kontak darurat?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContact(id);
            } catch (err: any) {
              Alert.alert('Gagal menghapus', err.message);
            }
          },
        },
      ]
    );
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await setPrimaryContact(id);
    } catch (err: any) {
      Alert.alert('Gagal menyetel utama', err.message);
    }
  };

  const getRelationshipLabel = (value: string | null) => {
    return RELATIONSHIPS.find((r) => r.value === value)?.label || 'Kontak';
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator size="large" color="#f472b6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950 p-6">
      <Stack.Screen options={{ title: 'Kontak Darurat' }} />

      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-2xl font-bold text-white">Kontak Darurat</Text>
        <Pressable onPress={openAddModal} className="rounded-full bg-pink-500 px-4 py-2">
          <Text className="text-white font-semibold">+ Tambah</Text>
        </Pressable>
      </View>

      {isError ? (
        <View className="rounded-3xl bg-red-950/50 p-5 mb-4 border border-red-800">
          <Text className="text-red-300 text-center">{error?.message ?? 'Gagal memuat kontak.'}</Text>
        </View>
      ) : null}

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="rounded-3xl border border-slate-800 bg-slate-900 p-5 mb-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center space-x-2">
                  <Text className="text-lg font-bold text-white">{item.name}</Text>
                  {item.isPrimary ? (
                    <View className="rounded-full bg-pink-500/20 px-2 py-0.5 border border-pink-500/30">
                      <Text className="text-[10px] text-pink-400 font-semibold">Utama</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-slate-400 text-sm mt-1">{item.phone}</Text>
                <Text className="text-xs text-slate-500 mt-2 bg-slate-800 self-start px-2.5 py-1 rounded-full">
                  🏷️ {getRelationshipLabel(item.relationship)}
                </Text>
              </View>

              <View className="flex-row space-x-2">
                <Pressable onPress={() => openEditModal(item)} className="p-2 bg-slate-800 rounded-xl">
                  <Text className="text-slate-300 text-xs">Edit</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(item.id, item.name)} className="p-2 bg-rose-950 rounded-xl">
                  <Text className="text-rose-300 text-xs">Hapus</Text>
                </Pressable>
              </View>
            </View>

            {!item.isPrimary ? (
              <Pressable
                onPress={() => handleSetPrimary(item.id)}
                className="mt-4 border border-dashed border-slate-700 p-2.5 rounded-2xl items-center active:bg-slate-800"
              >
                <Text className="text-xs text-slate-400 font-semibold">Jadikan Kontak Utama</Text>
              </Pressable>
            ) : null}

            {/* Invite Status Section */}
            <View className="mt-4 border-t border-slate-850 pt-4 flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] uppercase text-slate-500 font-semibold">Status Sambungan</Text>
                {item.inviteStatus === 'accepted' ? (
                  <Text className="text-xs text-emerald-400 font-semibold mt-1">✅ Terhubung</Text>
                ) : item.inviteStatus === 'pending' && item.inviteCode ? (
                  <View className="mt-1">
                    <Text className="text-xs text-amber-400 font-semibold">⌛ Menunggu Konfirmasi</Text>
                    <Text className="text-[11px] text-slate-400 mt-0.5 font-mono">Kode: {item.inviteCode}</Text>
                  </View>
                ) : (
                  <Text className="text-xs text-slate-400 mt-1">❌ Belum Terhubung</Text>
                )}
              </View>

              {item.inviteStatus !== 'accepted' && (
                <Pressable
                  onPress={async () => {
                    try {
                      const res = await generateInviteCode(item.id);
                      Alert.alert(
                        'Kode Undangan Dibuat',
                        `Gunakan kode berikut untuk menghubungkan HP keluarga Anda:\n\n${res.inviteCode}\n\nMasukkan kode ini di menu Pendampingan Keluarga di HP pendamping.`,
                        [{ text: 'OK' }]
                      );
                    } catch (err: any) {
                      Alert.alert('Gagal', err.message || 'Gagal membuat kode undangan');
                    }
                  }}
                  disabled={isGeneratingInvite}
                  className="px-3.5 py-2 bg-pink-500/20 border border-pink-500/30 rounded-2xl active:bg-pink-500/30"
                >
                  <Text className="text-xs text-pink-400 font-semibold">
                    {item.inviteCode ? 'Regenerasi Kode' : 'Hubungkan HP'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="rounded-3xl bg-slate-900 border border-slate-800 p-8 items-center mt-4">
            <Text className="text-slate-300 font-medium text-center">Belum ada kontak darurat</Text>
            <Text className="text-slate-500 text-xs text-center mt-2 leading-relaxed">
              Tambahkan kontak darurat utama agar dapat menerima notifikasi otomatis ketika Anda mengaktifkan Guardian atau mengirimkan SOS.
            </Text>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-800">
            <Text className="text-xl font-bold text-white mb-6">
              {editingContact ? 'Edit Kontak Darurat' : 'Tambah Kontak Baru'}
            </Text>

            <View className="space-y-4">
              <TextField
                label="Nama Kontak"
                value={name}
                onChangeText={setName}
                placeholder="Masukkan nama kontak"
              />

              <TextField
                label="Nomor Telepon / HP"
                value={phone}
                onChangeText={phone => setPhone(phone.replace(/[^0-9+]/g, ''))}
                keyboardType="phone-pad"
                placeholder="Masukkan nomor telepon"
              />

              <View>
                <Text className="text-xs font-semibold uppercase text-slate-400 mb-2">Hubungan</Text>
                <View className="flex-row flex-wrap gap-2">
                  {RELATIONSHIPS.map((rel) => {
                    const selected = relationship === rel.value;
                    return (
                      <Pressable
                        key={rel.value}
                        onPress={() => setRelationship(rel.value)}
                        className={`px-4 py-2 rounded-full border ${
                          selected ? 'bg-pink-500 border-pink-500' : 'bg-slate-800 border-slate-700'
                        }`}
                      >
                        <Text className={`text-xs ${selected ? 'text-white font-semibold' : 'text-slate-400'}`}>
                          {rel.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {!editingContact || !editingContact.isPrimary ? (
                <Pressable
                  onPress={() => setIsPrimary(!isPrimary)}
                  className="flex-row items-center space-x-3 py-2"
                >
                  <View className={`w-5 h-5 rounded border items-center justify-center ${isPrimary ? 'bg-pink-500 border-pink-500' : 'border-slate-600'}`}>
                    {isPrimary ? <Text className="text-white text-[10px]">✓</Text> : null}
                  </View>
                  <Text className="text-slate-300 text-sm">Jadikan sebagai kontak utama</Text>
                </Pressable>
              ) : null}
            </View>

            <View className="mt-8 flex-row space-x-3">
              <Pressable
                onPress={() => setModalVisible(false)}
                className="flex-1 rounded-2xl bg-slate-800 p-4 items-center"
              >
                <Text className="text-white font-semibold">Batal</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                className="flex-1 rounded-2xl bg-pink-500 p-4 items-center"
              >
                <Text className="text-white font-semibold">Simpan</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
