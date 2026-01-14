import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Calendar, Clock } from 'lucide-react-native';

interface ScheduleTimePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  availabilityWindows?: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
  label?: string;
  testID?: string;
}

export function ScheduleTimePicker({
  value,
  onChange,
  availabilityWindows,
  label = 'Pickup Time',
  testID,
}: ScheduleTimePickerProps) {
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);

  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      if (!availabilityWindows || availabilityWindows.length === 0) {
        dates.push(date);
      } else {
        const dayOfWeek = date.getDay();
        const hasWindow = availabilityWindows.some(w => w.dayOfWeek === dayOfWeek);
        if (hasWindow) {
          dates.push(date);
        }
      }
    }
    
    return dates;
  }, [availabilityWindows]);

  const availableTimes = useMemo(() => {
    if (!selectedDate) return [];
    
    const times: Date[] = [];
    const dayOfWeek = selectedDate.getDay();
    
    if (!availabilityWindows || availabilityWindows.length === 0) {
      for (let hour = 9; hour <= 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const time = new Date(selectedDate);
          time.setHours(hour, minute, 0, 0);
          
          if (time > new Date()) {
            times.push(time);
          }
        }
      }
    } else {
      const windows = availabilityWindows.filter(w => w.dayOfWeek === dayOfWeek);
      
      windows.forEach(window => {
        const [startHour, startMinute] = window.startTime.split(':').map(Number);
        const [endHour, endMinute] = window.endTime.split(':').map(Number);
        
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        
        for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
          const hour = Math.floor(minutes / 60);
          const minute = minutes % 60;
          
          const time = new Date(selectedDate);
          time.setHours(hour, minute, 0, 0);
          
          if (time > new Date()) {
            times.push(time);
          }
        }
      });
    }
    
    return times;
  }, [selectedDate, availabilityWindows]);

  const formatDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    if (dateOnly.getTime() === today.getTime()) return 'Today';
    if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleConfirm = () => {
    if (selectedDate) {
      onChange(selectedDate);
      setModalVisible(false);
    }
  };

  const displayValue = value
    ? `${formatDate(value)} at ${formatTime(value)}`
    : 'Select pickup time';

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setModalVisible(true)}
        testID={testID}
      >
        <View style={styles.triggerContent}>
          <View style={styles.triggerLeft}>
            <Clock size={20} color={Colors.gray[600]} />
            <View style={styles.triggerTextContainer}>
              <Text style={styles.triggerLabel}>{label}</Text>
              <Text style={value ? styles.triggerValue : styles.triggerPlaceholder}>
                {displayValue}
              </Text>
            </View>
          </View>
          <Calendar size={20} color={Colors.gray[400]} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Pickup Time</Text>
            <TouchableOpacity onPress={handleConfirm} disabled={!selectedDate}>
              <Text style={[styles.doneButton, !selectedDate && styles.doneButtonDisabled]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pickerContainer}>
            <View style={styles.pickerColumn}>
              <Text style={styles.columnTitle}>Date</Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {availableDates.map((date, idx) => {
                  const isSelected = selectedDate &&
                    date.toDateString() === selectedDate.toDateString();
                  
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.dateOption, isSelected && styles.dateOptionSelected]}
                      onPress={() => setSelectedDate(date)}
                      testID={`date-${idx}`}
                    >
                      <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                        {formatDate(date)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {selectedDate && (
              <View style={styles.pickerColumn}>
                <Text style={styles.columnTitle}>Time</Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                >
                  {availableTimes.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>No available times</Text>
                    </View>
                  ) : (
                    availableTimes.map((time, idx) => {
                      const isSelected = selectedDate &&
                        time.getTime() === selectedDate.getTime();
                      
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.timeOption, isSelected && styles.timeOptionSelected]}
                          onPress={() => setSelectedDate(time)}
                          testID={`time-${idx}`}
                        >
                          <Text style={[styles.timeText, isSelected && styles.timeTextSelected]}>
                            {formatTime(time)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    padding: 16,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  triggerTextContainer: {
    flex: 1,
  },
  triggerLabel: {
    fontSize: 12,
    color: Colors.gray[600],
    fontWeight: '600',
    marginBottom: 2,
  },
  triggerValue: {
    fontSize: 16,
    color: Colors.gray[900],
    fontWeight: '600',
  },
  triggerPlaceholder: {
    fontSize: 16,
    color: Colors.gray[400],
  },
  modal: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  cancelButton: {
    fontSize: 16,
    color: Colors.gray[600],
  },
  doneButton: {
    fontSize: 16,
    color: Colors.gradient.green,
    fontWeight: '600',
  },
  doneButtonDisabled: {
    color: Colors.gray[300],
  },
  pickerContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  pickerColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: Colors.gray[200],
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray[700],
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.gray[50],
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  scrollContent: {
    paddingVertical: 8,
  },
  dateOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  dateOptionSelected: {
    backgroundColor: Colors.gradient.green + '15',
  },
  dateText: {
    fontSize: 16,
    color: Colors.gray[700],
  },
  dateTextSelected: {
    color: Colors.gradient.green,
    fontWeight: '600',
  },
  timeOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  timeOptionSelected: {
    backgroundColor: Colors.gradient.green + '15',
  },
  timeText: {
    fontSize: 16,
    color: Colors.gray[700],
  },
  timeTextSelected: {
    color: Colors.gradient.green,
    fontWeight: '600',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.gray[400],
    fontStyle: 'italic',
  },
});
