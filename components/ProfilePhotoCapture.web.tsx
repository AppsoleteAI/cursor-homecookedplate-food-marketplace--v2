import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassPressable } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';

export type CapturedPhoto = { base64: string; mimeType: string };

export function ProfilePhotoCapture({ onDone }: { onDone: (photo: CapturedPhoto | null) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          window.alert('Camera access is required. A photo from the internet or your gallery is not accepted.');
        }
        onDoneRef.current(null);
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const side = Math.min(video.videoWidth, video.videoHeight, 1024);
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d');
    if (!context) return;
    const sx = Math.max(0, (video.videoWidth - side) / 2);
    const sy = Math.max(0, (video.videoHeight - side) / 2);
    context.drawImage(video, sx, sy, side, side, 0, 0, side, side);
    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';
    stop();
    onDoneRef.current(base64 ? { base64, mimeType: 'image/jpeg' } : null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.frame}>
        {React.createElement('video', {
          ref: (node: HTMLVideoElement | null) => {
            videoRef.current = node;
            if (node && streamRef.current) node.srcObject = streamRef.current;
          },
          autoPlay: true,
          playsInline: true,
          muted: true,
          style: { width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#111' },
        })}
      </View>
      <GlassPressable onPress={shoot} style={styles.use} testID="use-profile-photo">
        <Text style={styles.useText}>Use this photo</Text>
      </GlassPressable>
      <GlassPressable
        onPress={() => {
          stop();
          onDoneRef.current(null);
        }}
        testID="cancel-profile-photo"
      >
        <Text style={styles.cancel}>Cancel</Text>
      </GlassPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 24,
    marginBottom: 16,
    gap: 12,
  },
  frame: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.gray[900],
  },
  use: {
    backgroundColor: Colors.gradient.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  useText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  cancel: {
    textAlign: 'center',
    color: Colors.gray[700],
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 8,
  },
});
