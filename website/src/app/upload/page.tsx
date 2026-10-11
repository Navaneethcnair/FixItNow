'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './upload.module.css';
import { useLanguage } from '@/context/LanguageContext';

type UploadMode = 'image' | 'video';

// Compress uploaded image client-side to ~80KB JPEG so it never exceeds browser storage quotas
function compressImageClientSide(file: File, maxDim = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = (e.target?.result as string) || '';
    };
    reader.readAsDataURL(file);
  });
}

export default function UploadPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<UploadMode>('image');
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'fixitnow'>('fixitnow');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  // Camera states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Input & Camera Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraImageRef = useRef<HTMLInputElement>(null);
  const nativeCameraVideoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const router = useRouter();
  const supabase = createClient();

  // Stop & Cleanup Camera (Immediately stops and revokes camera stream tracks)
  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStream(null);
    setIsCameraOpen(false);
    setIsRecording(false);
    setRecordingTime(0);
    setCameraError('');
  }, []);

  // Guaranteed camera shutdown on unmount, page hide, or navigation (WITHOUT resetting native camera app state)
  useEffect(() => {
    const handleStopOnLeave = () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {}
        });
        cameraStreamRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };

    window.addEventListener('pagehide', handleStopOnLeave);
    window.addEventListener('beforeunload', handleStopOnLeave);
    window.addEventListener('popstate', handleStopOnLeave);

    return () => {
      handleStopOnLeave();
      window.removeEventListener('pagehide', handleStopOnLeave);
      window.removeEventListener('beforeunload', handleStopOnLeave);
      window.removeEventListener('popstate', handleStopOnLeave);
    };
  }, [stopCamera]);

  // Bind video element srcObject when camera stream changes
  useEffect(() => {
    if (isCameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen, cameraStream]);

  // Start Live Camera (Access camera ONLY when requested with native mobile app fallback)
  const startCamera = async (targetMode?: UploadMode, targetFacing?: 'user' | 'environment') => {
    const activeMode = targetMode || mode;
    const activeFacing = targetFacing || facingMode;
    console.log(`[FixItNow] startCamera requested | mode: ${activeMode}, facing: ${activeFacing}, protocol: ${typeof window !== 'undefined' ? window.location.protocol : 'ssr'}`);
    setError('');
    setCameraError('');

    // Fallback immediately to native camera app if browser doesn't support getUserMedia or on HTTP LAN access
    const hasGetUserMedia = typeof window !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
    if (!hasGetUserMedia) {
      console.warn('[FixItNow] getUserMedia API unavailable (non-HTTPS HTTP connection or unsupported browser). Launching native device camera app.');
      triggerNativeCamera(activeMode);
      return;
    }

    setIsCameraOpen(true);

    // Stop any current stream before opening new one
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      cameraStreamRef.current = null;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: activeFacing,
            width: { min: 1280, ideal: 1920, max: 3840 },
            height: { min: 720, ideal: 1080, max: 2160 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: activeMode === 'video',
        });
      } catch (err: any) {
        // Fallback without audio if microphone is blocked or missing
        if (activeMode === 'video') {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: activeFacing,
              width: { min: 1280, ideal: 1920, max: 3840 },
              height: { min: 720, ideal: 1080, max: 2160 },
              frameRate: { ideal: 30, max: 60 },
            },
            audio: false,
          });
        } else {
          throw err;
        }
      }

      cameraStreamRef.current = stream;
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('[FixItNow] In-browser camera stream error, launching native mobile camera:', err?.message || err);
      setIsCameraOpen(false);
      triggerNativeCamera(activeMode);
    }
  };

  // Flip Camera (Front / Back)
  const switchCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(mode, nextFacing);
  };

  // Snap Photo from camera stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const capturedFile = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleFile(capturedFile);
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  // Start Video Recording
  const startVideoRecording = () => {
    if (!cameraStream) return;
    recordedChunksRef.current = [];

    const mimeTypes = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    let selectedMime = '';
    for (const mime of mimeTypes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    try {
      const options: MediaRecorderOptions = {
        videoBitsPerSecond: 6000000, // 6 Mbps HD high-clarity video bitrate
      };
      if (selectedMime) {
        options.mimeType = selectedMime;
      }

      const mediaRecorder = new MediaRecorder(cameraStream, options);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(recordedChunksRef.current, {
          type: selectedMime || 'video/webm'
        });
        const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
        const recordedFile = new File([finalBlob], `video_${Date.now()}.${ext}`, {
          type: finalBlob.type
        });
        handleFile(recordedFile);
        stopCamera();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting MediaRecorder:', err);
      setCameraError('Failed to start video recording in this browser.');
    }
  };

  // Stop Video Recording
  const stopVideoRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
            );
            const data = await res.json();
            setLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              address: data.display_name || 'Location detected',
            });
          } catch {
            setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Location detected' });
          }
          setLocLoading(false);
        },
        () => setLocLoading(false)
      );
    } else {
      setLocLoading(false);
    }
  }, []);

  const handleFile = useCallback((f: File) => {
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setError('Please upload an image or video file.');
      return;
    }

    // Image size limit: 20MB, Video size limit: 20MB
    const maxSize = 20 * 1024 * 1024;
    if (f.size > maxSize) {
      setError(`File must be under 20MB.`);
      return;
    }

    setFile(f);
    setMode(isVideo ? 'video' : 'image');
    setError('');

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      // For videos, create object URL for preview (faster than data URL)
      const url = URL.createObjectURL(f);
      setPreview(url);
    }
  }, []);

  const clearFile = useCallback(() => {
    if (preview && file?.type.startsWith('video/')) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview(null);
    setError('');
    // Reset file inputs
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (nativeCameraImageRef.current) nativeCameraImageRef.current.value = '';
    if (nativeCameraVideoRef.current) nativeCameraVideoRef.current.value = '';
  }, [preview, file]);

  // Helper to trigger file inputs on desktop & mobile devices reliably
  const triggerFileInput = useCallback((targetMode?: UploadMode) => {
    const activeMode = targetMode || mode;
    console.log(`[FixItNow] triggerFileInput executed | targetMode: ${activeMode}`);
    if (activeMode === 'video') {
      if (videoInputRef.current) {
        console.log('[FixItNow] Triggering videoInputRef.current.click()');
        videoInputRef.current.value = '';
        videoInputRef.current.click();
      } else {
        console.error('[FixItNow] videoInputRef.current is null!');
      }
    } else {
      if (imageInputRef.current) {
        console.log('[FixItNow] Triggering imageInputRef.current.click()');
        imageInputRef.current.value = '';
        imageInputRef.current.click();
      } else {
        console.error('[FixItNow] imageInputRef.current is null!');
      }
    }
  }, [mode]);

  // Helper to launch native phone camera app directly (for iOS/Android HTTP access fallback)
  const triggerNativeCamera = useCallback((targetMode?: UploadMode) => {
    const activeMode = targetMode || mode;
    console.log(`[FixItNow] triggerNativeCamera executed | targetMode: ${activeMode}`);
    if (activeMode === 'video') {
      if (nativeCameraVideoRef.current) {
        console.log('[FixItNow] Triggering nativeCameraVideoRef.current.click()');
        nativeCameraVideoRef.current.value = '';
        nativeCameraVideoRef.current.click();
      } else {
        console.error('[FixItNow] nativeCameraVideoRef.current is null!');
      }
    } else {
      if (nativeCameraImageRef.current) {
        console.log('[FixItNow] Triggering nativeCameraImageRef.current.click()');
        nativeCameraImageRef.current.value = '';
        nativeCameraImageRef.current.click();
      } else {
        console.error('[FixItNow] nativeCameraImageRef.current is null!');
      }
    }
  }, [mode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleUploadAndAnalyze = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setUploadProgress(file.type.startsWith('video/') ? 'Uploading video...' : 'Uploading image...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('selectedModel', selectedModel);
      if (location) {
        formData.append('locationLat', location.lat.toString());
        formData.append('locationLng', location.lng.toString());
        formData.append('locationAddress', location.address);
      }

      const modelLabel = selectedModel === 'fixitnow' ? 'FixItNow Custom AI' : 'Google Gemini AI';
      setUploadProgress(
        file.type.startsWith('video/')
          ? `🤖 ${modelLabel} is watching your video and detecting the problem...`
          : `🤖 ${modelLabel} is analyzing your photo...`
      );

      // Generate a lightweight compressed image URL for instant local display
      let compressedMediaUrl = '';
      if (file.type.startsWith('image/')) {
        try {
          compressedMediaUrl = await compressImageClientSide(file);
        } catch {}
      }

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed');

      // Create a lightweight copy of job data for sessionStorage (omit huge base64 videos)
      const jobToStore = { ...data.job };
      if (compressedMediaUrl) {
        jobToStore.media_url = compressedMediaUrl;
      } else if (
        (jobToStore.media_type === 'video' || file.type.startsWith('video/')) &&
        jobToStore.media_url &&
        jobToStore.media_url.startsWith('data:')
      ) {
        jobToStore.media_url = '';
      }

      // Store job data safely in sessionStorage
      try {
        sessionStorage.setItem(`job-${data.job.id}`, JSON.stringify(jobToStore));
      } catch (e) {
        console.error('Failed to save job to sessionStorage:', e);
      }

      setUploadProgress('✅ Analysis complete! Redirecting...');

      // Navigate to results page
      router.push(`/results/${data.job.id}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setUploading(false);
      setUploadProgress('');
    }
  };

  const isVideoFile = file?.type.startsWith('video/');

  const videoTips = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="5"></circle>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
        </svg>
      ),
      text: t('upload.tip_video_lighting')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
      text: t('upload.tip_video_duration')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
      ),
      text: t('upload.tip_video_focus')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      ),
      text: t('upload.tip_video_angles')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
          <line x1="7" y1="2" x2="7" y2="22"></line>
          <line x1="17" y1="2" x2="17" y2="22"></line>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="2" y1="7" x2="7" y2="7"></line>
          <line x1="2" y1="17" x2="7" y2="17"></line>
          <line x1="17" y1="17" x2="22" y2="17"></line>
          <line x1="17" y1="7" x2="22" y2="7"></line>
        </svg>
      ),
      text: t('upload.tip_video_steady')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21.3 20.4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1.7-.7l16.3 16.3a1 1 0 0 1 .3.8z"></path>
          <line x1="6" y1="18" x2="6" y2="16"></line>
          <line x1="8" y1="18" x2="8" y2="14"></line>
          <line x1="10" y1="18" x2="10" y2="16"></line>
          <line x1="12" y1="18" x2="12" y2="12"></line>
        </svg>
      ),
      text: t('upload.tip_video_scale')
    }
  ];

  const imageTips = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="5"></circle>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
        </svg>
      ),
      text: t('upload.tip_image_lighting')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21.3 20.4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1.7-.7l16.3 16.3a1 1 0 0 1 .3.8z"></path>
          <line x1="6" y1="18" x2="6" y2="16"></line>
          <line x1="8" y1="18" x2="8" y2="14"></line>
          <line x1="10" y1="18" x2="10" y2="16"></line>
          <line x1="12" y1="18" x2="12" y2="12"></line>
        </svg>
      ),
      text: t('upload.tip_image_scale')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
      ),
      text: t('upload.tip_image_focus')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
      ),
      text: t('upload.tip_image_angles')
    }
  ];

  return (
    <div className={styles.page}>
      <div className={`container ${styles.container}`}>
        <div className={styles.header}>
          <span className="section-tag">✦ {t('upload.detect_problem')}</span>
          <h1 className="section-title">{t('upload.whats_problem')}</h1>
          <p className="section-subtitle">{t('upload.subtitle')}</p>
        </div>

        {/* Location */}
        <div className={styles.locationBar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {locLoading ? (
            <span className={styles.locLoading}>{t('home.detecting_location')}</span>
          ) : location ? (
            <span className={styles.locAddress}>{location.address}</span>
          ) : (
            <span className={styles.locError}>{t('upload.location_unavailable')}</span>
          )}
        </div>

        {/* Mode Toggle */}
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'image' ? styles.modeBtnActive : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[FixItNow] Mode switched to image');
              if (file) clearFile();
              setMode('image');
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>{t('upload.photo_tab')}</span>
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'video' ? styles.modeBtnActive : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[FixItNow] Mode switched to video');
              if (file) clearFile();
              setMode('video');
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <span>{t('upload.video_tab')}</span>
          </button>
        </div>

        {/* Hidden standard file inputs (for browsing gallery) */}
        <input
          id="image-file-input"
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          onChange={e => {
            console.log('[FixItNow] image-file-input selected file:', e.target.files?.[0]?.name);
            e.target.files?.[0] && handleFile(e.target.files[0]);
          }}
        />
        <input
          id="video-file-input"
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className={styles.fileInput}
          onChange={e => {
            console.log('[FixItNow] video-file-input selected file:', e.target.files?.[0]?.name);
            e.target.files?.[0] && handleFile(e.target.files[0]);
          }}
        />

        {/* Hidden native camera capture inputs (for direct hardware camera launch) */}
        <input
          id="native-camera-image-input"
          ref={nativeCameraImageRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.fileInput}
          onChange={e => {
            console.log('[FixItNow] native-camera-image-input selected file:', e.target.files?.[0]?.name);
            e.target.files?.[0] && handleFile(e.target.files[0]);
          }}
        />
        <input
          id="native-camera-video-input"
          ref={nativeCameraVideoRef}
          type="file"
          accept="video/*"
          capture="environment"
          className={styles.fileInput}
          onChange={e => {
            console.log('[FixItNow] native-camera-video-input selected file:', e.target.files?.[0]?.name);
            e.target.files?.[0] && handleFile(e.target.files[0]);
          }}
        />

        {/* Upload Zone */}
        <div
          className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${preview ? styles.hasPreview : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={(e) => {
            if (!preview) {
              const target = e.target as HTMLElement;
              // Ignore dropzone click if user tapped on a child button or label
              if (target.closest('button') || target.closest('label')) {
                console.log('[FixItNow] dropZone onClick ignored child element tap');
                return;
              }
              console.log('[FixItNow] dropZone background tapped, triggering file picker for mode:', mode);
              triggerFileInput(mode);
            }
          }}
        >
          {preview ? (
            <div className={styles.previewWrap}>
              {isVideoFile ? (
                <video src={preview} className={styles.previewMedia} controls playsInline />
              ) : (
                <img src={preview} className={styles.previewMedia} alt="Preview" />
              )}
              <div className={styles.previewOverlay}>
                <span className={styles.mediaBadge}>
                  {isVideoFile ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  )}
                  <span>{isVideoFile ? t('upload.video_tab') : t('upload.photo_tab')}</span>
                </span>
              </div>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
              >
                ✕ {t('upload.remove')}
              </button>
            </div>
          ) : (
            <div className={styles.dropContent}>
              <div className={styles.dropIcon}>
                {mode === 'video' ? (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
                    <polygon points="23 7 16 12 23 17 23 7"/>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
              </div>
              <h3 className={styles.dropTitle}>
                {mode === 'video' ? t('upload.drag_video') : t('upload.drag_photo')}
              </h3>
              <p className={styles.dropSubtitle}>
                {t('upload.drag_drop_hint')}
              </p>
              <div className={styles.dropActions}>
                <label
                  htmlFor={mode === 'video' ? 'video-file-input' : 'image-file-input'}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => {
                    console.log(`[FixItNow] Choose ${mode} label tapped`);
                    if (mode === 'video' && videoInputRef.current) videoInputRef.current.value = '';
                    if (mode === 'image' && imageInputRef.current) imageInputRef.current.value = '';
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                    {mode === 'video' ? (
                      <>
                        <polygon points="23 7 16 12 23 17 23 7"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                      </>
                    ) : (
                      <>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </>
                    )}
                  </svg>
                  {mode === 'video' ? t('upload.choose_video') : t('upload.choose_photo')}
                </label>

                <label
                  htmlFor={mode === 'video' ? 'native-camera-video-input' : 'native-camera-image-input'}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => {
                    console.log(`[FixItNow] Take/Record ${mode} camera label tapped`);
                    if (mode === 'video' && nativeCameraVideoRef.current) nativeCameraVideoRef.current.value = '';
                    if (mode === 'image' && nativeCameraImageRef.current) nativeCameraImageRef.current.value = '';
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                    {mode === 'video' ? (
                      <>
                        <polygon points="23 7 16 12 23 17 23 7"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                      </>
                    ) : (
                      <>
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </>
                    )}
                  </svg>
                  {mode === 'video' ? t('upload.record_video') : t('upload.take_photo')}
                </label>
              </div>
            </div>
          )}
        </div>

        {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}

        {/* Analyze CTA */}
        {file && (
          <div className={styles.analyzeCta}>
            <div className={styles.fileInfo}>
              <span className={styles.fileIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  {isVideoFile ? (
                    <>
                      <polygon points="23 7 16 12 23 17 23 7"/>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </>
                  ) : (
                    <>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </>
                  )}
                </svg>
              </span>
              <div>
                <div className={styles.fileName}>{file.name}</div>
                <div className={styles.fileSize}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB • {isVideoFile ? 'Video' : 'Image'}
                </div>
              </div>
            </div>

            {uploading && uploadProgress && (
              <div className={styles.progressBar}>
                <div className={styles.progressPulse} />
                <span className={styles.progressText}>{uploadProgress}</span>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={handleUploadAndAnalyze}
              disabled={uploading}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {uploading ? (
                <><span className="spinner" /> {isVideoFile ? 'Analyzing Video...' : 'Analyzing Photo...'}</>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v3M4.93 10.93l2.83 2.83M19.07 10.93l-2.83 2.83"/>
                    <rect x="5" y="8" width="14" height="12" rx="4"/>
                    <circle cx="9.5" cy="13" r="1.5" fill="currentColor"/>
                    <circle cx="14.5" cy="13" r="1.5" fill="currentColor"/>
                    <path d="M9.5 17h5"/>
                  </svg>
                  <span>Analyze {isVideoFile ? 'Video' : 'Photo'} with AI →</span>
                </>
              )}
            </button>

            {isVideoFile && (
              <p className={styles.videoNote}>
                💡 AI will watch the entire video to detect the problem, estimate dimensions, and assess urgency.
              </p>
            )}
          </div>
        )}

        {/* Tips */}
        <div className={styles.tips}>
          <h3 className={styles.tipsTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'text-bottom' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Tips for best results
          </h3>
          <div className={styles.tipsGrid}>
            {mode === 'video' ? (
              <>
                {videoTips.map((t, idx) => (
                  <div key={idx} className={styles.tipCard}>
                    <span className={styles.tipIconWrap}>{t.icon}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                {imageTips.map((t, idx) => (
                  <div key={idx} className={styles.tipCard}>
                    <span className={styles.tipIconWrap}>{t.icon}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Live Device Camera Viewfinder Modal */}
        {isCameraOpen && (
          <div className={styles.cameraOverlay} onClick={stopCamera}>
            <div className={styles.cameraModalContainer} onClick={(e) => e.stopPropagation()}>
              <div className={styles.cameraHeader}>
                <div className={styles.cameraBadge}>
                  <span className={isRecording ? styles.recDotPulse : styles.liveDot} />
                  {isRecording ? `REC ${formatTime(recordingTime)}` : mode === 'video' ? 'LIVE VIDEO CAMERA' : 'LIVE PHOTO CAMERA'}
                </div>
                <div className={styles.cameraHeaderButtons}>
                  <button
                    className={styles.cameraIconBtn}
                    onClick={switchCamera}
                    title="Switch Camera (Front / Back)"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8h-3l4 4 4-4h-3c0-3.3 2.7-6 6-6s6 2.7 6 6h-3l4 4 4-4h-3z" />
                    </svg>
                  </button>
                  <button className={styles.cameraCloseBtn} onClick={stopCamera} title="Close Camera">
                    ✕
                  </button>
                </div>
              </div>

              {cameraError ? (
                <div className={styles.cameraErrorBox}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p>{cameraError}</p>
                  <div className={styles.cameraErrorBtns}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        stopCamera();
                        if (mode === 'video') {
                          nativeCameraVideoRef.current?.click();
                        } else {
                          nativeCameraImageRef.current?.click();
                        }
                      }}
                    >
                      📷 Open Camera App
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={stopCamera}>
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.viewfinderWrap}>
                  <video ref={videoRef} className={styles.cameraVideo} autoPlay playsInline muted={mode === 'image'} />
                  <div className={styles.viewfinderFrame}>
                    <div className={`${styles.corner} ${styles.topLeft}`} />
                    <div className={`${styles.corner} ${styles.topRight}`} />
                    <div className={`${styles.corner} ${styles.bottomLeft}`} />
                    <div className={`${styles.corner} ${styles.bottomRight}`} />
                  </div>
                </div>
              )}

              {!cameraError && (
                <div className={styles.cameraControls}>
                  {mode === 'image' ? (
                    <button className={styles.shutterBtnPhoto} onClick={capturePhoto} title="Take Photo">
                      <div className={styles.shutterInnerPhoto} />
                    </button>
                  ) : isRecording ? (
                    <button className={styles.shutterBtnStop} onClick={stopVideoRecording} title="Stop Recording">
                      <div className={styles.shutterInnerStop} />
                    </button>
                  ) : (
                    <button className={styles.shutterBtnRecord} onClick={startVideoRecording} title="Start Recording">
                      <div className={styles.shutterInnerRecord} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

